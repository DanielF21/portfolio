/**
 * Plain, serializable shapes that cross the server -> client boundary.
 *
 * `src/data/resume.tsx` imports `lucide-react` and embeds JSX, so it must never
 * be imported from a client component. The server page maps it into these types
 * and Next serializes them into the RSC payload.
 *
 * This file must never import `three`.
 */

export interface PlanetProject {
  readonly title: string;
  readonly href: string;
  readonly dates: string;
  readonly description: string;
  readonly technologies: readonly string[];
  readonly imageSrc: string;
  readonly imageWidth: number;
  readonly imageHeight: number;
  /** Precomputed from href.startsWith("/") so the modal knows whether to open
   *  in a new tab. */
  readonly isInternal: boolean;
  readonly links: readonly { readonly type: string; readonly href: string }[];
}

export interface PlanetEducation {
  readonly school: string;
  readonly href: string;
  readonly degree: string;
  readonly logoUrl: string;
  readonly start: string;
  readonly end: string;
}

export interface PlanetSocial {
  readonly name: string;
  readonly url: string;
}

export type MarkerContent =
  | { readonly kind: "project"; readonly project: PlanetProject }
  | { readonly kind: "about"; readonly summary: string; readonly avatarUrl: string; readonly location: string }
  | { readonly kind: "education"; readonly entries: readonly PlanetEducation[] }
  | { readonly kind: "skills"; readonly skills: readonly string[] }
  | { readonly kind: "resume"; readonly pdfUrl: string }
  | { readonly kind: "contact"; readonly socials: readonly PlanetSocial[] };

export type MarkerKind = MarkerContent["kind"];

/** The four authored regions of the planet. Everything outside them is
 *  "wilds": inert scenery with no markers. */
export type DistrictId = "house" | "machine" | "bio" | "gallery";

/** Which prop kit dresses a patch of ground. The wilds have scenery but no
 *  district, hence the extra member. */
export type PropKitId = DistrictId | "wilds";

export interface PlanetMarker {
  readonly id: string;
  /** Short text drawn on the in-world label. */
  readonly label: string;
  /** Heading shown in the modal. */
  readonly title: string;
  /** Unit vector from the planet centre. Plain object, not a Vector3, so it
   *  stays serializable and this file stays three-free. */
  readonly dir: { readonly x: number; readonly y: number; readonly z: number };
  /** Which authored region this marker belongs to; drives accent colour and
   *  surrounding terrain. */
  readonly district: DistrictId;
  /** Key into the asset manifest for the marker's 3D body. */
  readonly assetId: string;
  readonly content: MarkerContent;
}

/** Where the character starts, as a unit vector. */
export interface SpawnPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}
