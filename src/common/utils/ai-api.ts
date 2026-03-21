const BASE_URL = 'http://localhost:8080/api/v1';

const AI = {
  RECOMMENDATION_GET_CLINIC_BY_ID: (clinic_id: string) =>
    `${BASE_URL}/recommendation-clinic/clinics/${clinic_id}`,
  RECOMMENDATION_GET_SIMILAR_CLINICS: (clinic_id: string) =>
    `${BASE_URL}/recommendation-clinic/clinics/${clinic_id}/similar`,
  RECOMMENDATION_RECOMMEND_FROM_APPOINTMENT: `${BASE_URL}/recommendation-clinic/clinics/recommend/patient-appointment`,
  RECOMMENDATION_LIST_TABLES: `${BASE_URL}/recommendation-clinic/db/tables`,

  BAD_WORD_DETECTION: `${BASE_URL}/bad-word-detection/detect`,
  BAD_WORD_DETECTION_BATCH: `${BASE_URL}/bad-word-detection/detect/batch`,
  BAD_WORD_DETECTION_HATE_SPEECH: `${BASE_URL}/bad-word-detection/detect/hate-speech`,
  BAD_WORD_DETECTION_TOXIC: `${BASE_URL}/bad-word-detection/detect/toxic`,
  BAD_WORD_DETECTION_HATE_SPANS: `${BASE_URL}/bad-word-detection/detect/hate-spans`,
  BAD_WORD_DETECTION_HEALTH: `${BASE_URL}/bad-word-detection/health`,

  FEEDBACK_LABEL_DESCRIPTION: `${BASE_URL}/feedback/label-description`,
  FEEDBACK_LABEL_IMAGE: `${BASE_URL}/feedback/label-image`,

  RAG_CHAT: `${BASE_URL}/rag/chat`,
  RAG_INGEST: `${BASE_URL}/rag/knowledge-base/ingest`,
  RAG_SEARCH: `${BASE_URL}/rag/knowledge-base/search`,
  RAG_SYNC: `${BASE_URL}/rag/knowledge-base/sync`,
  RAG_GET_HISTORY: (conversation_id: string) =>
    `${BASE_URL}/rag/conversations/${conversation_id}/history`,
  RAG_DELETE_CONVERSATION: (conversation_id: string) =>
    `${BASE_URL}/rag/conversations/${conversation_id}`,

  SYNC_DATA: `${BASE_URL}/rag/knowledge-base/sync`,

  FRACTURE_DETECTION: `${BASE_URL}/fracture-detection/detect`,
};

export const API = {
  AI,
};
