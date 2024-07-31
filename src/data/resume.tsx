import { Icons } from "@/components/icons";
import { CodeIcon, HomeIcon, NotebookIcon, PencilLine } from "lucide-react";

export const DATA = {
  name: "Daniel Fleming",
  initials: "DF",
  url: "https://danielfleming.xyz",
  location: "Boston, MA",
  locationLink: "https://www.google.com/maps/place/boston",
  description:
    "Tech enthusiast and MIT graduate focused on impactful solutions.",
  summary:
    "In 2024, I graduated from MIT with a BS in Computer Science and Engineering. I've contributed to research projects at MIT's Sports Lab and Digital Humanities Lab, and I'm passionate about building innovative solutions using machine learning and data science.",
  avatarUrl: "/me.png",
  skills: [
    "React",
    "Next.js",
    "Typescript",
    "Node.js",
    "Python",
    "Rust",
    "Tailwind CSS",
    "Assembly",
    "JavaSript",
    "Java",
    "C++",
  ],
  navbar: [
    { href: "/", icon: HomeIcon, label: "Home" },
    { href: "/blog", icon: NotebookIcon, label: "Blog" },
    { href: "#", icon: CodeIcon, label: "Projects" },
    { href: "#", icon: PencilLine, label: "Notes" },
  ],
  contact: {
    email: "daniel11ftw@gmail.com",
    tel: "+123456789",
    social: {
      GitHub: {
        name: "GitHub",
        url: "https://github.com/DanielF21/",
        icon: Icons.github,

        navbar: true,
      },
      LinkedIn: {
        name: "LinkedIn",
        url: "https://www.linkedin.com/in/daniel-fleming-687b13184/",
        icon: Icons.linkedin,

        navbar: true,
      },
      X: {
        name: "X",
        url: "https://x.com/dfleming_ai",
        icon: Icons.x,

        navbar: true,
      },
      email: {
        name: "Send Email",
        url: "#",
        icon: Icons.email,

        navbar: false,
      },
    },
  },

  work: [
  /*
    {
      company: "Mitre Media",
      href: "https://mitremedia.com/",
      badges: [],
      location: "Toronto, ON",
      title: "Software Engineer",
      logoUrl: "/mitremedia.png",
      start: "May 2017",
      end: "August 2017",
      description:
        "Designed and implemented a robust password encryption and browser cookie storage system in Ruby on Rails. Leveraged the Yahoo finance API to develop the dividend.com equity screener",
    },
  */
  ],
  
  education: [
    {
      school: "Massachusetts Institute of Technology",
      href: "https://www.mit.edu/",
      degree: "Bachelor of Science in Computer Science and Engineering",
      logoUrl: "/MIT.png",
      start: "2020",
      end: "2024",
    },
    {
      school: "The Science Academy of South Texas",
      href: "https://scienceacademy.stisd.net/",
      degree: "Diploma",
      logoUrl: "/scitech.png",
      start: "2016",
      end: "2020",
    },
  ],
    projects: [
      /*
      {
        title: "Automatic Chat",
        href: "https://automatic.chat",
        dates: "April 2023 - March 2024",
        active: true,
        description:
          "Developed an AI Customer Support Chatbot which automatically responds to customer support tickets using the latest GPT models.",
        technologies: [
          "Next.js",
          "Typescript",
          "PostgreSQL",
          "Prisma",
          "TailwindCSS",
          "Shadcn UI",
          "Magic UI",
          "Stripe",
          "Cloudflare Workers",
        ],
        links: [
          {
            type: "Website",
            href: "https://automatic.chat",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: "",
        video:
          "https://pub-83c5db439b40468498f97946200806f7.r2.dev/automatic-chat.mp4",
      },
      */ 
    ],

  hackathons: [
  
  
   
  ],
} as const;
