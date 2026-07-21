import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function Page({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="screen"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
