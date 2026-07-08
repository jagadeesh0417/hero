export interface BharatPeOrderResponse {
  success: boolean;
  order_id?: string;
  payment_url?: string;
  message?: string;
}

export interface BharatPeVerifyResponse {
  success: boolean;
  status?: 'SUCCESS' | 'FAILED' | 'PENDING';
  txn_id?: string;
  amount?: number;
  payment_timestamp?: string;
  message?: string;
}

function getConfig() {
  const apiKey = process.env.BHARATPE_API_KEY || '';
  const apiSecret = process.env.BHARATPE_API_SECRET || '';
  const merchantId = process.env.BHARATPE_MERCHANT_ID || '';
  const isSandbox = process.env.BHARATPE_SANDBOX === 'true';

  if (!apiKey || !apiSecret || !merchantId) {
    throw new Error('BharatPe credentials not configured. Set BHARATPE_API_KEY, BHARATPE_API_SECRET, and BHARATPE_MERCHANT_ID env vars.');
  }

  const baseUrl = isSandbox
    ? 'https://sandbox.bharatpe.com/api/v1'
    : 'https://api.bharatpe.com/api/v1';

  return { apiKey, apiSecret, merchantId, baseUrl };
}

export async function createPaymentOrder(
  bookingId: string,
  amount: number,
  customer: { name: string; mobile: string; email?: string }
): Promise<BharatPeOrderResponse> {
  try {
    const { apiKey, apiSecret, merchantId, baseUrl } = getConfig();

    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bharatpe/callback`;

    const payload = {
      merchant_id: merchantId,
      order_id: bookingId,
      amount: Math.round(amount * 100),
      currency: 'INR',
      customer_name: customer.name,
      customer_mobile: customer.mobile,
      customer_email: customer.email || '',
      callback_url: callbackUrl,
      description: `Booking ${bookingId} - Suman Travels`,
    };

    const res = await fetch(`${baseUrl}/order/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      return {
        success: false,
        message: data.message || 'Failed to create payment order',
      };
    }

    return {
      success: true,
      order_id: data.order_id || bookingId,
      payment_url: data.payment_url || '',
    };
  } catch (err: any) {
    console.error('[BharatPe] createPaymentOrder error:', err?.message || err);
    return { success: false, message: 'Payment service unavailable. Please try again.' };
  }
}

export async function verifyPayment(
  orderId: string
): Promise<BharatPeVerifyResponse> {
  try {
    const { apiKey, apiSecret, baseUrl } = getConfig();

    const res = await fetch(`${baseUrl}/order/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret,
      },
      body: JSON.stringify({ order_id: orderId }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, message: data.message || 'Payment verification failed' };
    }

    return {
      success: data.status === 'SUCCESS',
      status: data.status || 'PENDING',
      txn_id: data.txn_id || '',
      amount: data.amount ? Number(data.amount) / 100 : undefined,
      payment_timestamp: data.payment_timestamp || '',
      message: data.message || '',
    };
  } catch (err: any) {
    console.error('[BharatPe] verifyPayment error:', err?.message || err);
    return { success: false, message: 'Verification service unavailable' };
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return expected === signature;
  } catch {
    return false;
  }
}
