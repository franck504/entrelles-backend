const User = require('../models/User');
const Trip = require('../models/Trip');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configuration Cloudinary pour l'hébergement des images
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration Multer pour la gestion des uploads en mémoire
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

/**
 * @desc    Consulter le profil public d'une utilisatrice
 * @route   GET /api/users/:id
 * @access  Public
 */
const getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -security -stripe -kyc -bankingInfo -metadata.ipAddress -metadata.userAgent');

    if (!user || user.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Utilisatrice non trouvée ou profil non disponible' });
    }

    const publicProfile = {
      id: user._id,
      profile: {
        displayName: user.profile.displayName,
        firstName: user.profile.firstName,
        avatar: user.profile.avatar,
        bio: user.profile.bio,
        city: user.profile.address?.city || null,
        country: user.profile.address?.country || 'France'
      },
      stats: {
        rating: user.stats.rating,
        ratingsCount: user.stats.ratingsCount,
        tripsAsDriver: user.stats.tripsAsDriver,
        tripsAsPassenger: user.stats.tripsAsPassenger,
        tripsCompleted: user.stats.tripsCompleted,
        memberSince: user.createdAt
      },
      preferences: user.preferences,
      verification: {
        isEmailVerified: user.verification.isEmailVerified,
        isPhoneVerified: user.verification.isPhoneVerified,
        isIdentityVerified: user.verification.isIdentityVerified
      },
      lastActive: user.metadata.lastActive
    };

    res.status(200).json({ success: true, user: publicProfile });

  } catch (error) {
    console.error('Erreur récupération profil public:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * @desc    Mettre à jour le profil complet de l'utilisatrice
 * @route   PUT /api/users/profile
 * @access  Privé
 */
const updateCompleteProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {};
    const allowedProfileFields = ['displayName', 'firstName', 'lastName', 'phone', 'bio', 'dateOfBirth', 'address', 'profileImageUrl', 'vehicleImageUrl'];

    allowedProfileFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'address' && typeof req.body[field] === 'object') {
          Object.keys(req.body[field]).forEach(addressField => {
            fieldsToUpdate[`profile.address.${addressField}`] = req.body[field][addressField];
          });
        } else {
          fieldsToUpdate[`profile.${field}`] = req.body[field];
        }
      }
    });

    if (req.body.preferences && typeof req.body.preferences === 'object') {
      const allowedPreferences = ['allowSmoking', 'allowPets', 'allowFood', 'musicPreference', 'chatLevel', 'maxDetour', 'autoAcceptBookings'];
      allowedPreferences.forEach(pref => {
        if (req.body.preferences[pref] !== undefined) {
          fieldsToUpdate[`preferences.${pref}`] = req.body.preferences[pref];
        }
      });
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun champ valide à mettre à jour' });
    }

    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

    res.status(200).json({ success: true, message: 'Profil mis à jour avec succès', user });

  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du profil' });
  }
};

/**
 * @desc    Uploader une image pour le profil ou le véhicule
 * @route   POST /api/users/upload-image
 * @access  Privé
 */
const uploadUserImage = async (req, res) => {
  try {
    const { type } = req.body;
    if (!['profile', 'vehicle'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Type d\'image invalide' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'Aucune image fournie' });

    const folder = type === 'profile' ? 'entrelles/profile_images' : 'entrelles/vehicle_images';
    const field = type === 'profile' ? 'profile.profileImageUrl' : 'profile.vehicleImageUrl';

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: `${type}_${req.user.id}_${Date.now()}`,
          transformation: [{ width: 800, height: 600, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }],
          overwrite: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    const updateData = {};
    updateData[field] = uploadResult.secure_url;
    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true });

    res.status(200).json({
      success: true,
      message: 'Image mise à jour avec succès',
      imageUrl: uploadResult.secure_url,
      user
    });

  } catch (error) {
    console.error('Erreur upload image:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'upload de l\'image' });
  }
};

/**
 * @desc    Récupérer les conductrices à proximité ou actives
 * @route   GET /api/users/nearby-drivers
 * @access  Public
 */
const getNearbyDrivers = async (req, res) => {
  try {
    const { city } = req.query;
    const query = { status: 'active' };
    if (city) query['profile.address.city'] = new RegExp(city, 'i');

    const users = await User.find(query)
      .select('profile.displayName profile.avatar profile.profileImageUrl stats.rating stats.tripsAsDriver metadata.lastActive')
      .sort({ 'metadata.lastActive': -1 })
      .limit(20)
      .lean();

    const driversWithActivity = await Promise.all(users.map(async (user) => {
      const activeTrip = await Trip.findOne({
        driver: user._id,
        status: 'active',
        departureDateTime: { $gt: new Date() }
      }).select('_id').lean();

      return {
        id: user._id,
        displayName: user.profile.displayName,
        avatar: user.profile.profileImageUrl || user.profile.avatar || '',
        rating: user.stats.rating,
        tripsAsDriver: user.stats.tripsAsDriver,
        lastActive: user.metadata.lastActive,
        hasActiveTrip: !!activeTrip,
        activeTripId: activeTrip ? activeTrip._id.toString() : null
      };
    }));

    res.status(200).json({ success: true, count: driversWithActivity.length, drivers: driversWithActivity });

  } catch (error) {
    console.error('Erreur récupération conductrices:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

module.exports = {
  getPublicProfile,
  updateCompleteProfile,
  uploadUserImage,
  getNearbyDrivers,
  upload
};
