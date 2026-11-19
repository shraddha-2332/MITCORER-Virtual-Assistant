// Explicit requests must not be converted into unrelated institutional evidence.
// This is a bounded guard, not general institution/entity recognition.
export function reviewBoundaryResponse(question, language) {
  const leakedPaper = /\b(?:leak(?:ed)?|stolen|confidential)\s+(?:exam\s+|question\s+|answer\s+)?(?:papers?|keys?)\b/i.test(question);
  const otherInstitution = /\b(?:VIT\s+Pune|Vishwakarma\s+Institute\s+of\s+Technology|COEP|IIT\s+(?:Bombay|Delhi|Madras)|NIT\s+(?:Trichy|Warangal|Surathkal))\b/i.test(question);
  if (!leakedPaper && !otherInstitution) return null;
  const messages = leakedPaper ? {
    en: 'I cannot help obtain leaked or confidential exam papers. For legitimate study material, use officially published past papers or contact the college.',
    mr: 'फुटलेले किंवा गोपनीय प्रश्नपत्र मिळवून देण्यात मी मदत करू शकत नाही. अभ्यासासाठी अधिकृतपणे प्रकाशित जुन्या प्रश्नपत्रिका वापरा किंवा महाविद्यालयाशी संपर्क साधा.',
    hi: 'मैं लीक हुए या गोपनीय प्रश्नपत्र प्राप्त करने में मदद नहीं कर सकता। पढ़ाई के लिए आधिकारिक रूप से प्रकाशित पुराने प्रश्नपत्रों का उपयोग करें या कॉलेज से संपर्क करें।',
  } : {
    en: 'This question names another institution. MITRA provides MITCORER guidance and cannot verify the other institution’s fees, admission rules or records. Please consult that institution’s official sources.',
    mr: 'या प्रश्नात दुसऱ्या संस्थेचे नाव आहे. MITRA हे MITCORER विषयी मार्गदर्शन करते; दुसऱ्या संस्थेचे शुल्क, प्रवेश नियम किंवा नोंदी यांची पडताळणी करू शकत नाही. कृपया त्या संस्थेचे अधिकृत स्रोत तपासा.',
    hi: 'इस प्रश्न में किसी अन्य संस्थान का नाम है। MITRA, MITCORER के बारे में मार्गदर्शन देता है और दूसरे संस्थान की फीस, प्रवेश नियमों या रिकॉर्ड की पुष्टि नहीं कर सकता। कृपया उस संस्थान के आधिकारिक स्रोत देखें।',
  };
  return { answer: messages[language] || messages.en, source: 'No verified record',
    evidence: [], officialLinks: [], outcomeStatus: 'UNSUPPORTED_TOPIC',
    model: 'deterministic-rag-fallback', requestedLanguage: language,
    responseLanguage: language, localizationStatus: language === 'en' ? 'original' : 'template',
    ...(language === 'en' ? {} : { languageReviewStatus: 'speaker-review-pending' }) };
}
