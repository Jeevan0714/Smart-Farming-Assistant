// src/data/cropProfiles.js

export const BUILT_IN_CROPS = {
  maize: {
    id: 'maize',
    name_en: 'Maize (Corn)',
    name_kn: 'ಮೆಕ್ಕೆಜೋಳ',
    emoji: '🌽',
    thresholds: {
      soilMoisture: { low: 40, optimal_min: 55, optimal_max: 75, high: 85 },
      nutrients:    { low: 35, optimal_min: 50, optimal_max: 70, high: 90 },
      temperature:  { low: 10, optimal_min: 21, optimal_max: 30, high: 38 },
    },
    weatherTips: {
      rainy_en: 'Maize is susceptible to lodging. Ensure field drainage.',
      rainy_kn: 'ಮಳೆಯಲ್ಲಿ ಮೆಕ್ಕೆಜೋಳ ಬೀಳುವ ಸಾಧ್ಯತೆ ಇದೆ. ತಕ್ಷಣ ನೀರು ಹರಿಯುವ ವ್ಯವಸ್ಥೆ ಮಾಡಿ.',
      sunny_en: 'Good sunshine benefits grain fill. Ensure adequate root zone moisture.',
      sunny_kn: 'ಒಳ್ಳೆ ಬಿಸಿಲು ಧಾನ್ಯ ತುಂಬಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ. ತೇವ ಸಾಕಷ್ಟು ಇರಲಿ.'
    }
  },
  rice: {
    id: 'rice',
    name_en: 'Rice (Paddy)',
    name_kn: 'ಭತ್ತ',
    emoji: '🌾',
    thresholds: {
      soilMoisture: { low: 60, optimal_min: 70, optimal_max: 90, high: 95 },
      nutrients:    { low: 40, optimal_min: 60, optimal_max: 80, high: 95 },
      temperature:  { low: 18, optimal_min: 22, optimal_max: 32, high: 38 },
    },
    weatherTips: {
      rainy_en: 'Maintain water level but ensure it doesn\'t exceed limits during heavy rain.',
      rainy_kn: 'ನೀರಿನ ಮಟ್ಟವನ್ನು ಕಾಯ್ದುಕೊಳ್ಳಿ ಆದರೆ ಭಾರಿ ಮಳೆಯ ಸಮಯದಲ್ಲಿ ಅದು ಮಿತಿ ಮೀರದಂತೆ ನೋಡಿಕೊಳ್ಳಿ.',
      sunny_en: 'High evaporation might occur. Monitor water level closely.',
      sunny_kn: 'ಹೆಚ್ಚಿನ ಬಾಷ್ಪೀಕರಣ ಸಂಭವಿಸಬಹುದು. ನೀರಿನ ಮಟ್ಟವನ್ನು ಹತ್ತಿರದಿಂದ ಮೇಲ್ವಿಚಾರಣೆ ಮಾಡಿ.'
    }
  },
  tomato: {
    id: 'tomato',
    name_en: 'Tomato',
    name_kn: 'ಟೊಮೇಟೋ',
    emoji: '🍅',
    thresholds: {
      soilMoisture: { low: 50, optimal_min: 60, optimal_max: 80, high: 90 },
      nutrients:    { low: 45, optimal_min: 55, optimal_max: 75, high: 90 },
      temperature:  { low: 15, optimal_min: 20, optimal_max: 28, high: 35 },
    },
    weatherTips: {
      rainy_en: 'Tomatoes are sensitive to overwatering and blight. Keep leaves dry if possible.',
      rainy_kn: 'ಟೊಮೆಟೊಗಳು ಅತಿಯಾದ ನೀರು ಮತ್ತು ಬ್ಲೈಟ್‌ಗೆ ಸಂವೇದನಾಶೀಲವಾಗಿರುತ್ತವೆ. ಸಾಧ್ಯವಾದರೆ ಎಲೆಗಳನ್ನು ಒಣಗಿಸಿ.',
      sunny_en: 'Consistent moisture is key to prevent blossom end rot.',
      sunny_kn: 'ಬ್ಲಾಸಮ್ ಎಂಡ್ ಕೊಳೆತವನ್ನು ತಡೆಗಟ್ಟಲು ಸ್ಥಿರವಾದ ತೇವಾಂಶವು ಪ್ರಮುಖವಾಗಿದೆ.'
    }
  },
  beans: {
    id: 'beans',
    name_en: 'Beans',
    name_kn: 'ಬೀನ್ಸ್',
    emoji: '🫘',
    thresholds: {
      soilMoisture: { low: 40, optimal_min: 50, optimal_max: 70, high: 80 },
      nutrients:    { low: 30, optimal_min: 45, optimal_max: 65, high: 85 },
      temperature:  { low: 15, optimal_min: 18, optimal_max: 26, high: 32 },
    },
    weatherTips: {
      rainy_en: 'Good drainage is essential for beans to prevent root rot.',
      rainy_kn: 'ಬೇರು ಕೊಳೆತವನ್ನು ತಡೆಗಟ್ಟಲು ಬೀನ್ಸ್‌ಗೆ ಉತ್ತಮ ಒಳಚರಂಡಿ ಅವಶ್ಯಕವಾಗಿದೆ.',
      sunny_en: 'Keep soil mulched to retain moisture during hot spells.',
      sunny_kn: 'ಬಿಸಿಲಿನಲ್ಲಿ ತೇವಾಂಶವನ್ನು ಉಳಿಸಿಕೊಳ್ಳಲು ಮಣ್ಣನ್ನು ಮಲ್ಚಿಂಗ್ ಮಾಡಿ.'
    }
  }
};
