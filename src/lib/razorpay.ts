import Razorpay from 'razorpay';
import crypto from 'crypto';

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET env vars.');
    }
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayInstance;
}

export async function createOrder(amount: number, receipt: string): Promise<{ id: string; amount: number; currency: string }> {
  const rzp = getRazorpay();
  const order = await rzp.orders.create({
    amount: amount * 100,
    currency: 'INR',
    receipt,
    payment_capture: true,
  });
  return { id: order.id, amount: Number(order.amount), currency: order.currency };
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expectedSig === signature;
}

export interface RazorpayPaymentDetails {
  status: string;
  method: string;
  bank_transaction_id: string | null;
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPaymentDetails> {
  const rzp = getRazorpay();
  const payment = await rzp.payments.fetch(paymentId);
  return {
    status: payment.status || '',
    method: payment.method || '',
    bank_transaction_id: payment.acquirer_data?.bank_transaction_id || null,
  };
}
