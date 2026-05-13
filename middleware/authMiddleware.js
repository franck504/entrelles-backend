const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware pour protéger les routes nécessitant une authentification
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Récupération du token depuis les headers ou les cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Accès refusé. Aucun jeton fourni.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Ce compte n\'est pas actif'
        });
      }

      req.user = {
        id: user._id,
        email: user.email,
        displayName: user.profile?.displayName || 'Une utilisatrice'
      };
      next();

    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Jeton invalide'
      });
    }

  } catch (error) {
    console.error('Erreur middleware d\'authentification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'authentification'
    });
  }
};

/**
 * Middleware d'authentification optionnel (permet d'identifier l'utilisateur s'il est connecté)
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (user && user.status === 'active') {
          req.user = {
            id: user._id,
            email: user.email,
            displayName: user.profile?.displayName || 'Une utilisatrice'
          };
        }
      } catch (error) {
        req.user = null;
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  protect,
  optionalAuth
};