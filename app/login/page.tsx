import LoginForm from '@/components/auth/login-form';

export default function LoginPage() {
    return (
        <div className="min-h-screen flex flex-col md:flex-row w-full font-sans bg-[#FAFAFA] md:bg-white">
            
            {/* Left Panel: Branding & Visuals (Visible on md and up for iPad/Desktop) */}
            <div className="hidden md:flex w-[45%] lg:w-[45%] bg-[#1F1F1F] flex-col justify-between p-10 lg:p-12 relative overflow-hidden text-white border-r border-[#333333]">
                {/* Subtle ambient gradients */}
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-[#2A2A2A] to-transparent pointer-events-none opacity-50"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-[#E65F2B]/5 blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 flex items-center h-20">
                    <div className="flex items-center gap-5 lg:gap-6">
                        <img 
                            src="/Alfamart-logo.png" 
                            alt="Alfamart Logo" 
                            className="h-12 lg:h-16 w-auto object-contain"
                        />
                        <div className="h-8 lg:h-10 w-[1px] bg-white/20"></div>
                        <img 
                            src="/Sparta-Logo.png" 
                            alt="Sparta Logo" 
                            className="h-12 lg:h-16 w-auto object-contain"
                        />
                    </div>
                </div>

                <div className="relative z-10 max-w-md">
                    <h1 className="text-3xl lg:text-4xl font-medium leading-tight tracking-tight mb-4 text-white">
                        Pusat Penyimpanan<br/>
                        <span className="text-[#E65F2B]">Dokumen DC</span>
                    </h1>
                </div>

                <div className="relative z-10 text-xs text-gray-500 font-medium tracking-wide uppercase">
                    &copy; {new Date().getFullYear()} PT Sumber Alfaria Trijaya Tbk.
                </div>
            </div>

            {/* Mobile Header (Visible only on mobile screens) */}
            <div className="md:hidden w-full bg-[#1F1F1F] px-6 pt-12 pb-24 relative overflow-hidden flex flex-col items-center text-center">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#2A2A2A] to-transparent pointer-events-none opacity-50"></div>
                <div className="absolute top-[-20%] left-[-20%] w-[300px] h-[300px] rounded-full bg-[#E65F2B]/10 blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10 flex items-center gap-4 mb-8">
                    <img src="/Alfamart-logo.png" alt="Alfamart Logo" className="h-10 w-auto object-contain" />
                    <div className="h-6 w-[1px] bg-white/20"></div>
                    <img src="/Sparta-Logo.png" alt="Sparta Logo" className="h-10 w-auto object-contain" />
                </div>
                
                <div className="relative z-10">
                    <h1 className="text-2xl font-medium leading-tight tracking-tight text-white">
                        Pusat Penyimpanan<br/>
                        <span className="text-[#E65F2B]">Dokumen DC</span>
                    </h1>
                </div>
            </div>

            {/* Right Panel: Login Form */}
            <div className="flex-1 flex flex-col justify-center px-6 md:px-12 lg:px-24 bg-[#FAFAFA] relative -mt-10 md:mt-0 z-20 pb-12 md:pb-0">
                
                <div className="w-full max-w-md mx-auto bg-white md:bg-transparent p-8 md:p-0 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] md:shadow-none border border-gray-100 md:border-none">
                    <div className="mb-8 text-center md:text-left">
                        <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Selamat Datang</h2>
                        <p className="text-gray-500 mt-2 text-sm">
                            Masuk menggunakan kredensial cabang Anda.
                        </p>
                    </div>

                    <LoginForm />
                </div>
                
                {/* Mobile footer */}
                <div className="md:hidden text-center mt-auto pt-12 text-[10px] text-gray-400 font-medium tracking-wide uppercase">
                    &copy; {new Date().getFullYear()} PT Sumber Alfaria Trijaya Tbk.
                </div>
            </div>
            
        </div>
    );
}
