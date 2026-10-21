import logo from "@/assets/logo.png";

export function Logo({ size = 40 }: { size?: number }) {
  return <img src={logo} width={size} height={size} alt="আল আহসান ফাউন্ডেশন লোগো" className="rounded-md" />;
}
