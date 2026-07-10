import type {
  EnrollmentPolicyRepository,
  EnrollmentPolicySummary,
} from '../../../../domain/repositories/enrollment-policy.repository.js';
import { EnrollmentPolicyModel } from '../models/enrollment-policy.model.js';

export class EnrollmentPolicyMongoRepository implements EnrollmentPolicyRepository {
  async findActiveByCareerId(careerId: string): Promise<EnrollmentPolicySummary | null> {
    const doc = await EnrollmentPolicyModel.findOne({ careerId, isActive: true })
      .sort({ updatedAt: -1 })
      .lean();

    if (!doc) return null;

    return {
      careerId: doc.careerId,
      period: doc.period,
      careerType: doc.careerType,
      currency: doc.paymentOptions[0]?.currency ?? 'PEN',
      inscriptionFee: doc.inscriptionFee,
      enrollmentFee: doc.enrollmentFee,
      monthlyFee: doc.monthlyFee,
      numberOfInstallments: doc.numberOfInstallments,
      description: doc.description,
      paymentOptions: doc.paymentOptions.map((p) => ({
        id: p.id,
        currency: p.currency,
        enrollmentFee: p.enrollmentFee,
        monthlyFee: p.monthlyFee,
        numberOfInstallments: p.numberOfInstallments,
        inscriptionFee: p.inscriptionFee,
        totalCost: p.totalCost,
        simpleCost: p.simpleCost,
        totalWithDiscount: p.totalWithDiscount,
        discount: p.discount,
      })),
    };
  }
}
