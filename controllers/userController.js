const User = require('../models/User');
const Trip = require('../models/Trip');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');

// Configuration Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuration Multer pour upload en mémoire
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    console.log('�� Multer - Type de fichier:', file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

// @desc    Voir profil public d'une utilisatrice
// @route   GET /api/users/:id
// @access  Public
const getPublicProfile = async (req, res) => {
  try {
    console.log('🔍 Récupération profil public pour ID:', req.params.id);

    const user = await User.findById(req.params.id)
      .select('-password -security -stripe -kyc -bankingInfo -metadata.ipAddress -metadata.userAgent');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisatrice non trouvée'
      });
    }

    if (user.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Profil non disponible'
      });
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
      lastActive: user.metadata.lastActive,
      responseTime: user.stats.responseTime
    };

    res.status(200).json({
      success: true,
      message: 'Profil public récupéré',
      user: publicProfile
    });

  } catch (error) {
    console.error('❌ Erreur récupération profil public:', error);

    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'ID utilisateur invalide'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

// @desc    Upload photo de profil
// @route   POST /api/users/upload-avatar
// @access  Private
const uploadAvatar = async (req, res) => {
  try {
    console.log('🔍 Upload avatar - User ID:', req.user?.id);
    console.log('🔍 Fichier reçu:', req.file ? 'OUI' : 'NON');

    if (req.file) {
      console.log('🔍 Détails fichier:', {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    console.log('📸 Début upload vers Cloudinary...');

    // Upload vers Cloudinary avec transformations
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'entrelles/avatars',
          public_id: `avatar_${req.user.id}_${Date.now()}`,
          transformation: [
            { width: 300, height: 300, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
          overwrite: true
        },
        (error, result) => {
          if (error) {
            console.error('❌ Erreur Cloudinary:', error);
            reject(error);
          } else {
            console.log('✅ Upload Cloudinary réussi:', result.secure_url);
            resolve(result);
          }
        }
      );

      uploadStream.end(req.file.buffer);
    });

    console.log('💾 Mise à jour base de données...');

    // Mettre à jour l'avatar dans la base de données
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { 'profile.avatar': uploadResult.secure_url },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Avatar mis à jour avec succès');

    res.status(200).json({
      success: true,
      message: 'Avatar mis à jour avec succès',
      avatar: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        width: uploadResult.width,
        height: uploadResult.height
      },
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        verification: user.verification,
        subscription: user.subscription,
        stats: user.stats,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur upload avatar:', error);

    if (error.message && error.message.includes('File size')) {
      return res.status(400).json({
        success: false,
        message: 'Fichier trop volumineux (max 5MB)'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'upload de l\'avatar',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getPublicProfile,
  uploadAvatar,
  upload // Export du middleware multer
};

// @desc    Mettre à jour profil complet
// @route   PUT /api/users/profile
// @access  Private
const updateCompleteProfile = async (req, res) => {
  try {
    console.log('🔍 Mise à jour profil pour user:', req.user.id);
    console.log('🔍 Données reçues:', req.body);

    const fieldsToUpdate = {};

    // Champs profil autorisés
    const allowedProfileFields = [
      'displayName', 'firstName', 'lastName', 'phone', 'bio',
      'dateOfBirth', 'address', 'profileImageUrl', 'vehicleImageUrl'
    ];

    // Mettre à jour les champs profil
    allowedProfileFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'address' && typeof req.body[field] === 'object') {
          // Gestion spéciale pour l'adresse (objet)
          Object.keys(req.body[field]).forEach(addressField => {
            fieldsToUpdate[`profile.address.${addressField}`] = req.body[field][addressField];
          });
        } else {
          fieldsToUpdate[`profile.${field}`] = req.body[field];
        }
      }
    });

    // Mettre à jour les préférences si fournies
    if (req.body.preferences && typeof req.body.preferences === 'object') {
      const allowedPreferences = [
        'allowSmoking', 'allowPets', 'allowFood', 'musicPreference',
        'chatLevel', 'maxDetour', 'autoAcceptBookings'
      ];

      allowedPreferences.forEach(pref => {
        if (req.body.preferences[pref] !== undefined) {
          fieldsToUpdate[`preferences.${pref}`] = req.body.preferences[pref];
        }
      });
    }

    // Validation : au moins un champ à mettre à jour
    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ valide à mettre à jour'
      });
    }

    console.log('🔍 Champs à mettre à jour:', fieldsToUpdate);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      fieldsToUpdate,
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    console.log('✅ Profil mis à jour avec succès');

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        preferences: user.preferences,
        stats: user.stats,
        verification: user.verification,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du profil'
    });
  }
};

// @desc    Upload image utilisateur (profil ou véhicule)
// @route   POST /api/users/upload-image
// @access  Private
const uploadUserImage = async (req, res) => {
  try {
    const { type } = req.body; // 'profile' or 'vehicle'

    if (!['profile', 'vehicle'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type d\'image invalide (doit être "profile" ou "vehicle")'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucune image fournie'
      });
    }

    const folder = type === 'profile' ? 'entrelles/profile_images' : 'entrelles/vehicle_images';
    const field = type === 'profile' ? 'profile.profileImageUrl' : 'profile.vehicleImageUrl';

    console.log('📸 Début upload vers Cloudinary pour type:', type);
    console.log('🔍 Vérification config Cloudinary:', {
      hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
      hasApiKey: !!process.env.CLOUDINARY_API_KEY,
      hasApiSecret: !!process.env.CLOUDINARY_API_SECRET
    });

    // Upload vers Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: `${type}_${req.user.id}_${Date.now()}`,
          transformation: [
            { width: 800, height: 600, crop: 'limit' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
          overwrite: true
        },
        (error, result) => {
          if (error) {
            console.error('❌ Erreur brute Cloudinary:', error);
            reject(error);
          } else {
            console.log('✅ Upload Cloudinary réussi:', result.secure_url);
            resolve(result);
          }
        }
      );
      uploadStream.end(req.file.buffer);
    });

    // Mettre à jour la base de données
    const updateData = {};
    updateData[field] = uploadResult.secure_url;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: `Image de ${type === 'profile' ? 'profil' : 'véhicule'} mise à jour`,
      imageUrl: uploadResult.secure_url,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
        verification: user.verification,
        subscription: user.subscription,
        stats: user.stats,
        preferences: user.preferences,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error(`❌ Erreur upload image détaillée:`, error);

    // Si l'erreur vient de Cloudinary, elle contient souvent des infos utiles
    const errorMessage = error.message || 'Erreur lors de l\'upload de l\'image';

    res.status(500).json({
      success: false,
      message: errorMessage,
      debug: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
};

// @desc    Récupérer les conductrices à proximité (même ville)
// @route   GET /api/users/nearby-drivers
// @access  Public
const getNearbyDrivers = async (req, res) => {
  try {
    const { city } = req.query;

    console.log('🔍 Recherche conductrices:', city ? `à proximité de ${city}` : 'toutes les conductrices');

    // 1. Construire la requête de base
    const query = { status: 'active' };

    // 2. Ajouter le filtre de ville si fourni
    if (city) {
      query['profile.address.city'] = new RegExp(city, 'i');
    }

    // 3. Trouver les utilisateurs (filtrées par ville ou toutes)
    const users = await User.find(query)
      .select('profile.displayName profile.avatar profile.profileImageUrl stats.rating stats.tripsAsDriver metadata.lastActive')
      .sort({ 'metadata.lastActive': -1 }) // Les plus actives en premier
      .limit(20)
      .lean();

    if (!users || users.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        drivers: []
      });
    }

    // 2. Pour chaque utilisatrice, vérifier si elle a un trajet actif
    const driversWithActivity = await Promise.all(users.map(async (user) => {
      const activeTrip = await Trip.findOne({
        driver: user._id,
        status: 'active',
        departureDateTime: { $gt: new Date() } // Trajet futur
      }).select('_id').lean();

      return {
        id: user._id,
        displayName: user.profile.displayName,
        avatar: user.profile.profileImageUrl || user.profile.avatar || '',
        rating: user.stats.rating,
        tripsAsDriver: user.stats.tripsAsDriver,
        lastActive: user.metadata.lastActive,
        hasActiveTrip: !!activeTrip
      };
    }));

    res.status(200).json({
      success: true,
      count: driversWithActivity.length,
      drivers: driversWithActivity
    });

  } catch (error) {
    console.error('❌ Erreur récupération conductrices proches:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

module.exports = {
  getPublicProfile,
  uploadAvatar,
  updateCompleteProfile,
  uploadUserImage,
  getNearbyDrivers, // ✅ AJOUT
  upload
};
