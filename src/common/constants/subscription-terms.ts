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
      'Patient record management',
      'Appointment scheduling',
      'Basic staff management',
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
      'Patient record management',
      'Appointment scheduling',
      'Staff management',
      'Medicine inventory management',
      'Statistical reports',
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
      'Patient record management',
      'Appointment scheduling',
      'Staff management',
      'Medicine inventory management',
      'Advanced statistical reports',
      'Payment management',
      'Payment gateway integration',
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
      'All Premium plan features',
      'Multi-branch management',
      '24/7 support',
      'Custom requirements',
      'Staff training',
      'Enhanced security',
    ],
    isPopular: false,
    status: SubscriptionServiceStatus.INACTIVE,
    chartColor: '#28a745',
  },
];
