import BlurFade from "@/components/magicui/blur-fade";
import BlurFadeText from "@/components/magicui/blur-fade-text";
import { ProjectCard } from "@/components/project-card";
import { ResumeCard } from "@/components/resume-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DATA } from "@/data/resume";
import Markdown from "react-markdown";
import Navbar from "@/components/navbar";
const BLUR_FADE_DELAY = 0.05;

export default function Page() {
  return (
    <main className="flex flex-col min-h-[100dvh] space-y-10">
      <section id="hero">
        <div className="mx-auto w-full max-w-2xl space-y-8">
          <div className="gap-2 flex justify-between">
            <div className="flex-col flex flex-1 space-y-1.5">
              <BlurFadeText
                delay={BLUR_FADE_DELAY}
                className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none"
                yOffset={8}
                text={`Hi, I'm ${DATA.name.split(" ")[0]} 👋`}
              />
              <BlurFadeText
                className="max-w-[600px] md:text-xl"
                delay={BLUR_FADE_DELAY}
                text={DATA.description}
              />
            </div>
            <BlurFade delay={BLUR_FADE_DELAY}>
              <Avatar className="size-28 border">
                <AvatarImage alt={DATA.name} src={DATA.avatarUrl} />
                <AvatarFallback>{DATA.initials}</AvatarFallback>
              </Avatar>
            </BlurFade>
          </div>
        </div>
      </section>

      <Tabs defaultValue="about" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="resume">Resume</TabsTrigger>
        </TabsList>

        <TabsContent value="about">
          <div className="space-y-10">
            <section id="about">
              <BlurFade delay={BLUR_FADE_DELAY * 3}>
                <h2 className="text-xl font-bold">About</h2>
              </BlurFade>
              <BlurFade delay={BLUR_FADE_DELAY * 4}>
                <Markdown className="prose max-w-full text-pretty font-sans text-sm text-muted-foreground dark:prose-invert">
                  {DATA.summary}
                </Markdown>
              </BlurFade>
            </section>

            <section id="education">
              <div className="flex min-h-0 flex-col gap-y-3">
                <BlurFade delay={BLUR_FADE_DELAY * 7}>
                  <h2 className="text-xl font-bold">Education</h2>
                </BlurFade>
                {DATA.education.map((education, id) => (
                  <BlurFade
                    key={education.school}
                    delay={BLUR_FADE_DELAY * 8 + id * 0.05}
                  >
                    <ResumeCard
                      key={education.school}
                      href={education.href}
                      logoUrl={education.logoUrl}
                      altText={education.school}
                      title={education.school}
                      subtitle={education.degree}
                      period={`${education.start} - ${education.end}`}
                    />
                  </BlurFade>
                ))}
              </div>
            </section>

            <section id="skills">
              <div className="flex min-h-0 flex-col gap-y-3">
                <BlurFade delay={BLUR_FADE_DELAY * 9}>
                  <h2 className="text-xl font-bold">Skills</h2>
                </BlurFade>
                <div className="flex flex-wrap gap-1">
                  {DATA.skills.map((skill, id) => (
                    <BlurFade key={skill} delay={BLUR_FADE_DELAY * 10 + id * 0.05}>
                      <Badge key={skill}>{skill}</Badge>
                    </BlurFade>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="projects">
          <section id="projects">
            <div className="space-y-12 w-full py-12">
              <BlurFade delay={BLUR_FADE_DELAY * 11}>
                <div className="flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="space-y-2">
                    <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                      My Projects
                    </div>
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                      Check out my latest work
                    </h2>
                    <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                      I&apos;ve worked on a variety of projects, from simple
                      websites to complex web applications. Here are a few of my
                      favorites.
                    </p>
                  </div>
                </div>
              </BlurFade>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-[800px] mx-auto">
                {DATA.projects.map((project, id) => (
                  <BlurFade
                    key={project.title}
                    delay={BLUR_FADE_DELAY * 12 + id * 0.05}
                  >
                    <ProjectCard
                      href={project.href}
                      key={project.title}
                      title={project.title}
                      description={project.description}
                      dates={project.dates}
                      tags={project.technologies}
                      image={project.image}
                      video={project.video}
                      links={project.links}
                    />
                  </BlurFade>
                ))}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="resume" className="h-[calc(100vh-200px)] min-h-[500px]">
          <section id="resume" className="h-full">
            <BlurFade delay={BLUR_FADE_DELAY * 13} className="h-full flex flex-col">
              <h2 className="text-xl font-bold mb-4">Resume</h2>
              <div className="flex-grow relative">
                <iframe
                  src="/daniel-resume.pdf"
                  className="absolute inset-0 w-full h-full"
                  style={{ border: "none" }}
                  title="Daniel's Resume"
                />
              </div>
            </BlurFade>
          </section>
        </TabsContent>
      </Tabs>

      <section id="contact">
        <div className="grid items-center justify-center gap-4 px-4 text-center md:px-6 w-full py-12">
          <BlurFade delay={BLUR_FADE_DELAY * 16}>
            <div className="space-y-3">
              <div className="inline-block rounded-lg bg-foreground text-background px-3 py-1 text-sm">
                Contact
              </div>
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
                Get in Touch
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                You can reach out to me at{" "}
                <a
                  href="mailto:daniel11ftw@gmail.com"
                  className="text-blue-500 hover:underline"
                >
                  daniel11ftw@gmail.com
                </a>
                .
              </p>
            </div>
          </BlurFade>
        </div>
      </section>
      <div className="pb-8">
        <Navbar />
      </div>
    </main>
  );
}
