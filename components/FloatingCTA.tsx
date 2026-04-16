// TODO: substitua pelo número real da igreja (somente dígitos, com DDI+DDD)
const WHATSAPP_NUMBER = "5519000000000";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className}>
      <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.129 6.744 3.047 9.381L1.054 31.2l6.023-1.932a15.91 15.91 0 008.927 2.736C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.534 22.612c-.396 1.116-1.956 2.04-3.228 2.312-.876.18-2.016.324-5.856-1.26-4.908-2.028-8.064-6.996-8.316-7.32-.24-.324-2.016-2.688-2.016-5.124 0-2.436 1.272-3.636 1.728-4.128.396-.432 1.044-.636 1.668-.636.204 0 .384.012.552.024.456.012.684.036 .984.768.372.912 1.272 3.132 1.38 3.36.108.228.216.528.072.828-.132.312-.252.456-.48.708-.228.252-.444.444-.672.72-.204.24-.432.492-.18.948.252.456 1.116 1.836 2.4 2.976 1.644 1.464 3.024 1.92 3.468 2.136.336.156.744.132.996-.132.324-.336.72-.888 1.116-1.44.288-.396.648-.444 1.02-.3.372.132 2.376 1.116 2.784 1.32.408.204.684.3.78.468.108.168.108.972-.288 2.088z" />
    </svg>
  );
}

export default function FloatingCTA() {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco no WhatsApp"
      className="fixed bottom-6 right-6 z-50
                 flex items-center justify-center w-14 h-14
                 bg-white/10 backdrop-blur-md border border-white/20 rounded-full
                 shadow-[0_4px_20px_0_rgba(0,0,0,0.15)]
                 hover:bg-white/20 hover:shadow-[0_4px_32px_0_rgba(0,0,0,0.25)]
                 hover:scale-110 active:scale-95
                 transition-all duration-300"
    >
      <WhatsAppIcon className="w-7 h-7 text-[#25D366]" />
    </a>
  );
}
