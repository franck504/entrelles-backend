const User = require('../models/User');
const Review = require('../models/Review');

/**
 * @desc    Laisser un avis sur une utilisatrice
 * @route   POST /api/reviews
 * @access  Private
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

        // Mettre à jour les stats de l'utilisateur cible
        const user = await User.findById(targetUserId);
        if (user) {
            user.stats.reviews.push(review._id);
            const allReviews = await Review.find({ targetUserId });
            const avgRating = allReviews.reduce((acc, curr) => acc + curr.rating, 0) / allReviews.length;

            user.stats.rating = avgRating;
            user.stats.ratingsCount = allReviews.length;
            await user.save();
        }

        res.status(201).json({
            success: true,
            review
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la création de l\'avis',
            error: error.message
        });
    }
};

/**
 * @desc    Obtenir les avis d'une utilisatrice
 * @route   GET /api/reviews/user/:userId
 * @access  Public
 */
const getUserReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ targetUserId: req.params.userId })
            .populate('reviewerId', 'profile.displayName profile.profileImageUrl')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            reviews
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la récupération des avis',
            error: error.message
        });
    }
};

module.exports = {
    createReview,
    getUserReviews
};
