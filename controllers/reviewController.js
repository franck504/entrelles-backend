const User = require('../models/User');
const Review = require('../models/Review');

/**
 * @desc    Laisser un avis sur une utilisatrice
 * @route   POST /api/reviews
 * @access  Privé
 */
const createReview = async (req, res) => {
  try {
    const { targetUserId, rating, comment, tripId } = req.body;
    const reviewerId = req.user.id;

    const review = await Review.create({
      reviewerId,
      targetUserId,
      rating,
      comment,
      tripId
    });

    // Mise à jour des statistiques de l'utilisatrice cible
    const user = await User.findById(targetUserId);
    if (user) {
      const allReviews = await Review.find({ targetUserId });
      const avgRating = allReviews.reduce((acc, curr) => acc + curr.rating, 0) / allReviews.length;

      user.stats.rating = parseFloat(avgRating.toFixed(1));
      user.stats.ratingsCount = allReviews.length;
      await user.save();
    }

    res.status(201).json({ success: true, review });

  } catch (error) {
    console.error('Erreur création avis:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'avis' });
  }
};

/**
 * @desc    Récupérer les avis reçus par une utilisatrice
 * @route   GET /api/reviews/user/:userId
 * @access  Public
 */
const getUserReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ targetUserId: req.params.userId })
      .populate('reviewerId', 'profile.displayName profile.profileImageUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, reviews });

  } catch (error) {
    console.error('Erreur récupération avis:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des avis' });
  }
};

module.exports = {
  createReview,
  getUserReviews
};
