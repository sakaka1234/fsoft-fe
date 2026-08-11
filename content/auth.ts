/** Artwork for the auth pages. Same Popsy source as the landing page. */
const art = (name: string) => `https://illustrations.popsy.co/orange/${name}.svg`;

export const authArt = {
  login: {
    src: art("home-office"),
    alt: "Illustration of a learner settling in at their desk",
  },
  register: {
    src: art("freelancer"),
    alt: "Illustration of a learner starting something new",
  },
} as const;
