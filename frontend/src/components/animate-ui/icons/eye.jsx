'use client';;
import * as React from 'react';
import { motion } from 'motion/react';

import { getVariants, useAnimateIconContext, IconWrapper } from '@animate-ui/react/icons';

const animations = {
  default: {
    group: {
      initial: { scaleY: 1 },
      animate: {
        scaleY: [1, 0.1, 1],
        transition: { duration: 0.4, ease: 'easeInOut' },
      },
    },

    path1: {},
    path2: {}
  },

  look: {
    group: {},
    path1: {},

    path2: {
      initial: { x: 0 },
      animate: {
        x: [0, -2.5, 2.5, 0],
        transition: { duration: 1, ease: 'easeInOut' },
      },
    }
  }
};

function IconComponent({
  size,
  ...props
}) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <motion.path
          d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"
          variants={variants.path1}
          initial="initial"
          animate={controls}
        />
        <motion.circle
          cx={12}
          cy={12}
          r={3}
          variants={variants.path2}
          initial="initial"
          animate={controls}
        />
      </motion.g>
    </motion.svg>
  );
}

function Eye(props) {
  return <IconWrapper icon={IconComponent} {...props} />;
}

export { animations, Eye, Eye as EyeIcon };
