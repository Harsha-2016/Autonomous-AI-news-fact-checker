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
