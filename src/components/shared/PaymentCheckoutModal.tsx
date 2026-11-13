import { useState } from 'react';
import { CheckCircle2, CreditCard, Lock, Smartphone, X } from 'lucide-react';
import type { Transaction } from '../../types/kwan';
import { formatUGX } from '../../lib/api';

interface PaymentCheckoutModalProps {
  open: boolean;
  title: string;
  subtitle: string;
  amountUGX: number;
  onClose: () => void;
  onConfirm: (method: Transaction['method']) => Promise<void>;
}

export function PaymentCheckoutModal({
  open,
  title,
  subtitle,
  amountUGX,
  onClose,
  onConfirm,
}: PaymentCheckoutModalProps) {
  const [method, setMethod] = useState<Transaction['method']>('MTN Mobile Money');
  const [phoneOrCard, setPhoneOrCard] = useState('+256 772 000 123');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handlePay = async () => {
    setError('');
    setProcessing(true);
    try {
      await onConfirm(method);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white/90 backdrop-blur-2xl border border-white/85 rounded-2xl max-w-md w-full p-6 shadow-lift">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold text-amber-800">KWAN Unified Checkout</p>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{title}</h3>
            <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close payment modal"
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-5 space-y-4">
          <div className="flex items-center justify-between glass-panel rounded-lg px-4 py-3">
            <span className="text-sm text-slate-600">Total Amount</span>
            <span className="text-lg font-bold text-slate-900 tabular-nums">{formatUGX(amountUGX)}</span>
          </div>

          {amountUGX > 0 && (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['MTN Mobile Money', 'Airtel Money', 'Card'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`px-3 py-2.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                        method === m
                          ? 'border-amber-600 bg-amber-50/90 text-amber-950'
                          : 'border-slate-200 bg-white/75 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        {m === 'Card' ? <CreditCard className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                      </div>
                      <span className="block truncate">{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {method === 'Card' ? 'Card Reference' : 'Mobile Money Phone Number'}
                </label>
                <input
                  type="text"
                  value={phoneOrCard}
                  onChange={(e) => setPhoneOrCard(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white/85 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Lock className="w-3.5 h-3.5" />
            <span>Processed by KWAN</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={handlePay}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#10B981] rounded-lg hover:bg-[#059669] disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              {processing ? 'Processing...' : amountUGX > 0 ? 'Complete Payment' : 'Enrol Free'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
