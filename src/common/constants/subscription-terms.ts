/**
 * Shared constants for English subscription-related terms
 * Used across multiple seeders for consistent English subscription terminology
 */
import { SubscriptionServiceStatus } from '../../modules/subscriptions/enums/subscription-service-status.enum';

export const SUBSCRIPTION_SERVICES = [
  {
    serviceName: 'Basic Plan',
    code: 'BASIC',
    description: 'Basic service plan for new clinics',
    price: 1000000,
    discount: 0,
    serviceFunctions: [
      'Dashboard',
      'Appointment Management',
      'Customer/Patient Management',
      'Branch Management',
      'Online Payment',
    ],
    isPopular: false,
    status: SubscriptionServiceStatus.ACTIVE,
    chartColor: '#6c757d',
  },
  {
    serviceName: 'Standard Plan',
    code: 'STANDARD',
    description: 'Standard service plan for growing clinics',
    price: 2500000,
    discount: 10,
    serviceFunctions: [
      'Dashboard',
      'Appointment Management',
      'Customer/Patient Management',
      'Branch Management',
      'Online Payment',
      'Chat Box',
    ],
    isPopular: false,
    status: SubscriptionServiceStatus.ACTIVE,
    chartColor: '#17a2b8',
  },
  {
    serviceName: 'Premium Plan',
    code: 'PREMIUM',
    description: 'Premium service plan for professional clinics',
    price: 5000000,
    discount: 15,
    serviceFunctions: [
      'Dashboard',
      'Appointment Management',
      'Customer/Patient Management',
      'Branch Management',
      'Online Payment',
      'Chat Box',
      'Feedback Analysis & Service Improvement',
    ],
    isPopular: true,
    status: SubscriptionServiceStatus.ACTIVE,
    chartColor: '#ffc107',
  },
  {
    serviceName: 'Enterprise Plan',
    code: 'ENTERPRISE',
    description: 'Enterprise service plan for large clinic chains',
    price: 10000000,
    discount: 20,
    serviceFunctions: [
      'Dashboard',
      'Appointment Management',
      'Customer/Patient Management',
      'Branch Management',
      'Online Payment',
      'Chat Box',
      'Feedback Analysis & Service Improvement',
      'AI Bone Detection (Image Outcome) & AI Diagnosis',
    ],
    isPopular: false,
    status: SubscriptionServiceStatus.ACTIVE,
    chartColor: '#28a745',
  },
];

export const SYSTEM_WIDE_AI_FEATURES = [
  'Customer Support Chatbot',
  'Bad Word Detection',
  'Recommendation System',
];
