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
    "In 2024, I graduated from MIT with a BS in Computer Science and Engineering. I've done data science research for the NBA and developed image processing algorithms for the Digital Humanities Lab. Talk to me about bullet chess and distance running!",
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
      {
        title: "Scheme Interpreter",
        href: "/scheme-interpreter",
        dates: "November 2022 - December 202",
        active: true,
        description:
          "Developed a Python based Scheme Language Interpreter.",
        technologies: [
          "Next.js",
          "Typescript",
          "Python",
          "TailwindCSS",
          "Shadcn UI",
          "Magic UI",
        ],
        links: [
          {
            type: "Website",
            href: "/scheme-interpreter",
            icon: <Icons.globe className="size-3" />,
          },
        ],
        image: {src: "/scheme.png", width: 400, height: 200},
        video:
          "",
      },
    ],

  hackathons: [
  
  
   
  ],
} as const;
