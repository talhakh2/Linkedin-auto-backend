import { Router } from 'express';
import { completePayment, SessionCheckout, EnterprisePlan, StarterSessionCheckout } from '../controllers/stripe.controller.js';

const router = Router();

router.route('/Starter').get(StarterSessionCheckout)
router.route('/Pro').get(SessionCheckout)
router.route('/Enterprise').get(EnterprisePlan)
router.route('/success').get(completePayment)

export default router;