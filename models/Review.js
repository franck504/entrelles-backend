const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    targetUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    tripId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Trip'
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        trim: true,
        maxLength: 500
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Empêcher un utilisateur de se noter lui-même
reviewSchema.pre('save', function (next) {
    if (this.reviewerId.toString() === this.targetUserId.toString()) {
        const err = new Error('Vous ne pouvez pas vous donner un avis à vous-même');
        return next(err);
    }
    next();
});

module.exports = mongoose.model('Review', reviewSchema);
