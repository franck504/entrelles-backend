const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index pour recherche rapide de conversation entre deux personnes
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
