import "./styles.css";import"./theme.css";import{PwaRegister}from"@/components/pwa-register";export const metadata={title:"24i Production",description:"Agency operating system",manifest:"/manifest.webmanifest"};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}<PwaRegister/></body></html>}
