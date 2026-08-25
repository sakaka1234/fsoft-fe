/** Artwork for the auth pages. Same self-hosted set as the landing page. */
const art = (name: string) => `/illustrations/${name}.svg`;

export const authArt = {
  login: {
    src: art("home-office"),
    alt: "Illustration of a learner settling in at their desk",
  },
  register: {
    src: art("freelancer"),
    alt: "Illustration of a learner starting something new",
  },
  forgotPassword: {
    src: art("question-mark"),
    alt: "Illustration of someone puzzling over a forgotten detail",
  },
} as const;
