const axios = require('axios');

/**
 * @desc    Obtenir une réponse de l'IA (Gemini)
 * @route   POST /api/ai/chat
 * @access  Public
 */
const chatWithAi = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Le message est requis'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Simulation de réponse si la clé API n'est pas configurée
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
      return res.status(200).json({
        success: true,
        reply: "Bonjour ! Je suis l'assistante Entrelles. Je suis actuellement en mode démonstration car la clé API Gemini n'est pas encore configurée. Entrelles est une plateforme de covoiturage 100% féminine dédiée à la sécurité et à la solidarité entre femmes."
      });
    }

    const systemPrompt = `Tu es l'assistante officielle d'Entrelles, l'application de covoiturage 100% féminine.
Ton but est de guider les utilisatrices sur le fonctionnement de la plateforme.

Points clés d'Entrelles à connaître :
1. Communauté : 100% femmes (conductrices et passagères).
2. Sécurité : Vérification d'identité (KYC) obligatoire pour les conductrices. Système de confiance et de notation.
3. Paiement & Abonnement : 
   - Entièrement sécurisé via Stripe. Le partage des frais est calculé équitablement.
   - Abonnement Premium : Pour être passagère et réserver des trajets, un abonnement de 3€/mois est requis.
4. Fonctionnement : 
   - Les conductrices publient des trajets après validation KYC stricte.
   - Les passagères recherchent et réservent des places.
   - La messagerie intégrée permet de discuter avant le départ.
5. Valeurs : Solidarité, sécurité, convivialité et écologie.

Réponds de manière chaleureuse, bienveillante et professionnelle. Utilise systématiquement le féminin. Si une question ne concerne pas Entrelles, ramène poliment la conversation sur le service.`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            role: "user",
            parts: [{ text: `CONTEXTE SYSTEME: ${systemPrompt}\n\nQUESTION DE L'UTILISATRICE: ${message}` }]
          }
        ]
      }
    );

    const reply = response.data.candidates[0].content.parts[0].text;

    res.status(200).json({ success: true, reply });

  } catch (error) {
    console.error('Erreur AI Controller:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la communication avec l\'IA'
    });
  }
};

module.exports = {
  chatWithAi
};
