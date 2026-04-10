import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

export const analyzeText = async (text) => {
  try {
    const response = await api.post('/analyze', { text });
    return response.data;
  } catch (error) {
    console.error("Error analyzing text:", error);
    throw error;
  }
};

export const simplifyVerdict = async (technical_verdict, truth_score) => {
  try {
    // using the actual backend URL here to match other requests
    // actually, api is mapped to /api for analyze, but /simplify is at the root level in backend
    // Or I can use axios targeting the backend. Wait, let me check where /api routing goes in vite config.
    const response = await axios.post('http://localhost:8000/simplify', { technical_verdict, truth_score });
    return response.data;
  } catch (error) {
    console.error("Error simplifying verdict:", error);
    throw error;
  }
};
