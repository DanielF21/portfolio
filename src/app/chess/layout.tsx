import { cn } from "@/lib/utils";

export default function ChessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        body {
          max-width: 100% !important;
          padding-left: 10% !important;
          padding-right: 10% !important;
          display: flex;
          justify-content: flex-start; /* Align content to the left */
          height: 100vh; /* Full height of the viewport */
          margin: 0; /* Remove default margin */
          box-sizing: border-box; /* Include padding and border in element's total width and height */
        }
        *, *::before, *::after {
          box-sizing: inherit; /* Apply box-sizing to all elements */
        }
      `}} />
      <div className={cn("flex w-full h-full")}> {/* Add red border here */}
        {children}
      </div>
    </>
  );
}