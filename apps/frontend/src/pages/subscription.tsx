import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Check, ShieldCheck, Zap, ArrowLeft, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const PLANS = [
  { id: 1, name: "1 Month", price: 100, originalPrice: 100, discount: 0, popular: false },
  { id: 3, name: "3 Months", price: 270, originalPrice: 300, discount: 10, popular: true },
  { id: 6, name: "6 Months", price: 510, originalPrice: 600, discount: 15, popular: false },
  { id: 12, name: "1 Year", price: 960, originalPrice: 1200, discount: 20, popular: false },
];

export default function SubscriptionPage() {
  const { user, login } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<number>(3);
  const [paymentMethod, setPaymentMethod] = useState<"esewa" | "fonepay" | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/user-subscription/checkout", { planMonths: selectedPlan });
      return res.json();
    },
    onSuccess: async () => {
      toast({
        title: "Payment Successful!",
        description: "Your subscription has been activated.",
      });
      // Fetch latest user data
      try {
        const profileRes = await apiRequest("GET", "/api/auth/me");
        if (profileRes.ok) {
           const data = await profileRes.json();
           login({ ...user!, ...data.user, subscriptionStatus: data.user.subscriptionStatus });
        }
      } catch (e) {
        console.error(e);
      }
      navigate("/dashboard");
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: err.message,
      });
    },
  });

  const handlePay = (method: "esewa" | "fonepay") => {
    setPaymentMethod(method);
    // Mock payment delay
    setTimeout(() => {
      checkoutMutation.mutate();
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Background glowing effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="p-4 flex items-center z-10 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-md">
        <button onClick={() => navigate("/dashboard")} className="p-2 mr-2 hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Upgrade Subscription</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 z-10">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <div className="text-center space-y-3 mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-yellow-500/10 rounded-2xl mb-2">
              <ShieldCheck className="w-8 h-8 text-yellow-500" />
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Unlock Full Access</h2>
            <p className="text-slate-400 max-w-lg mx-auto">
              Your 30-day free trial has expired. Upgrade your plan to continue tracking your school bus and receiving live updates.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300 border backdrop-blur-sm ${
                  selectedPlan === plan.id 
                    ? "bg-slate-800/80 border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.15)] transform scale-[1.02]" 
                    : "bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-slate-950 text-[0.65rem] font-bold px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                    <Zap className="w-3 h-3" /> Most Popular
                  </div>
                )}
                
                <h3 className="text-lg font-semibold text-slate-300 mb-2">{plan.name}</h3>
                
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-sm font-medium text-slate-400">NPR</span>
                  <span className="text-3xl font-black text-white">{plan.price}</span>
                </div>

                {plan.discount > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-slate-500 line-through">Rs. {plan.originalPrice}</span>
                    <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-md">Save {plan.discount}%</span>
                  </div>
                )}

                <ul className="space-y-2 mt-4 pt-4 border-t border-slate-800/50">
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span>Live GPS Tracking</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span>Arrival Alerts</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                    <span>Student Attendance</span>
                  </li>
                </ul>
              </div>
            ))}
          </div>

          {/* Payment Section */}
          <div className="mt-12 max-w-md mx-auto p-6 bg-slate-900/60 rounded-3xl border border-slate-800 backdrop-blur-md">
            <h3 className="text-center text-lg font-semibold mb-6">Select Payment Method</h3>
            
            <div className="space-y-3">
              <button 
                onClick={() => handlePay("esewa")}
                disabled={checkoutMutation.isPending}
                className="w-full flex items-center justify-between p-4 bg-[#60bb46]/10 hover:bg-[#60bb46]/20 border border-[#60bb46]/30 rounded-xl transition-colors group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#60bb46] rounded-lg flex items-center justify-center p-1">
                    <span className="text-white font-extrabold tracking-tighter text-sm">eSewa</span>
                  </div>
                  <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">Pay with eSewa</span>
                </div>
                {paymentMethod === "esewa" && checkoutMutation.isPending ? (
                  <Loader2 className="w-5 h-5 text-[#60bb46] animate-spin" />
                ) : (
                  <div className="text-sm font-bold text-[#60bb46]">Rs. {PLANS.find(p => p.id === selectedPlan)?.price}</div>
                )}
              </button>

              <button 
                onClick={() => handlePay("fonepay")}
                disabled={checkoutMutation.isPending}
                className="w-full flex items-center justify-between p-4 bg-[#e31837]/10 hover:bg-[#e31837]/20 border border-[#e31837]/30 rounded-xl transition-colors group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1">
                    <span className="text-[#e31837] font-extrabold tracking-tighter text-xs">fonepay</span>
                  </div>
                  <span className="font-semibold text-slate-200 group-hover:text-white transition-colors">Pay with Fonepay</span>
                </div>
                {paymentMethod === "fonepay" && checkoutMutation.isPending ? (
                  <Loader2 className="w-5 h-5 text-[#e31837] animate-spin" />
                ) : (
                  <div className="text-sm font-bold text-[#e31837]">Rs. {PLANS.find(p => p.id === selectedPlan)?.price}</div>
                )}
              </button>
            </div>
            <p className="text-xs text-center text-slate-500 mt-6">
              Payment processing is secure and encrypted.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
