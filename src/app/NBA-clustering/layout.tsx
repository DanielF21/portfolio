import { cn } from "@/lib/utils";

export default function NBALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        body {
          max-width: 100% !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
      `}} />
      <div className={cn("max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8")}>
        {children}
      </div>
    </>
  );
}