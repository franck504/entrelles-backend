const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  profile: {
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name cannot exceed 50 characters']
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: [30, 'First name cannot exceed 30 characters']
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [30, 'Last name cannot exceed 30 characters']
    },
    avatar: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: ['femme'],
      lowercase: true
    },
    phone: {
      type: String,
      match: [/^[\+]?[0-9]{10,15}$/, 'Please provide a valid phone number']
    },
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: {
        type: String,
        default: 'France'
      },
      coordinates: {
        lat: Number,
        lng: Number
      }
    }
  },
  preferences: {
    allowSmoking: {
      type: Boolean,
      default: false
    },
    allowPets: {
      type: Boolean,
      default: true
    },
    allowFood: {
      type: Boolean,
      default: true
    },
    musicPreference: {
      type: String,
      enum: ['none', 'low', 'medium', 'high'],
      default: 'medium'
    },
    chatLevel: {
      type: String,
      enum: ['none', 'low', 'medium', 'high'],
      default: 'medium'
    },
    maxDetour: {
      type: Number,
      default: 10,
      min: 0,
      max: 50
    },
    autoAcceptBookings: {
      type: Boolean,
      default: false
    }
  },
  verification: {
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    phoneVerificationCode: String,
    phoneVerificationExpires: Date,
    isIdentityVerified: {
      type: Boolean,
      default: false
    },
    identityDocuments: [{
      type: String,
      url: String,
      verifiedAt: Date
    }]
  },
  stats: {
    tripsAsDriver: {
      type: Number,
      default: 0
    },
    tripsAsPassenger: {
      type: Number,
      default: 0
    },
    tripsCompleted: {
      type: Number,
      default: 0
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    ratingsCount: {
      type: Number,
      default: 0
    },
    totalEarnings: {
      type: Number,
      default: 0
    },
    responseTime: {
      type: Number,
      default: 0
    },
    cancellationRate: {
      type: Number,
      default: 0
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'premium'],
      default: 'free'
    },
    isActive: {
      type: Boolean,
      default: false
    },
    stripeSubscriptionId: String,
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'unpaid', 'inactive', 'incomplete'],
      default: 'inactive'
    },
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    }
  },
  stripe: {
    customerId: String,
    defaultPaymentMethodId: String
  },
  bankingInfo: {
    accountHolderName: {
      type: String,
      trim: true,
      maxlength: [100, 'Account holder name cannot exceed 100 characters']
    },
    iban: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/, 'Please provide a valid IBAN']
    },
    bic: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Please provide a valid BIC']
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: [100, 'Bank name cannot exceed 100 characters']
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    addedAt: {
      type: Date,
      default: Date.now
    }
  },
  security: {
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    lastLogin: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'deleted'],
    default: 'active'
  },
  metadata: {
    registrationSource: {
      type: String,
      enum: ['web', 'mobile', 'google'],
      default: 'web'
    },
    lastActive: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    referralCode: String,
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

userSchema.methods.hasActiveSubscription = function() {
  return this.subscription.status === 'active' && 
         this.subscription.currentPeriodEnd > new Date();
};

userSchema.methods.canCreateTrips = function() {
  return this.hasActiveSubscription() || this.subscription.plan === 'free';
};

userSchema.methods.getSubscriptionStatus = function() {
  if (!this.subscription.stripeSubscriptionId) {
    return 'no_subscription';
  }
  
  if (this.subscription.status === 'active' && this.subscription.currentPeriodEnd > new Date()) {
    return 'active';
  }
  
  if (this.subscription.status === 'past_due') {
    return 'past_due';
  }
  
  return 'inactive';
};

userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ 'profile.phone': 1 });
userSchema.index({ status: 1, 'metadata.lastActive': -1 });
userSchema.index({ 'subscription.stripeCustomerId': 1 });
userSchema.index({ 'subscription.stripeSubscriptionId': 1 });
userSchema.index({ 'subscription.status': 1 });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { userId: this._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

userSchema.methods.isLocked = function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
};

userSchema.methods.incLoginAttempts = async function() {
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: {
        'security.loginAttempts': 1,
        'security.lockUntil': 1
      }
    });
  }
  
  const updates = { $inc: { 'security.loginAttempts': 1 } };
  
  if (this.security.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = {
      'security.lockUntil': Date.now() + 2 * 60 * 60 * 1000
    };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: {
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    }
  });
};

module.exports = mongoose.model('User', userSchema);