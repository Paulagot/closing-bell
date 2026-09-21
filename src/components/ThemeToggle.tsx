"use client";

import {
  useEffect,
  useState,
} from "react";


type Theme =
  | "light"
  | "dark";


export default function ThemeToggle() {

  const [
    theme,
    setTheme,
  ] =
    useState<Theme>(
      "dark"
    );


  useEffect(
    () => {

      const saved =
        localStorage.getItem(
          "closingbell-theme"
        );


      const initial: Theme =
        saved === "light"
          ? "light"
          : "dark";


      setTheme(
        initial
      );


      document.documentElement.classList.toggle(
        "dark",
        initial ===
          "dark"
      );

    },
    []
  );


  function toggle() {

    const next: Theme =
      theme === "dark"
        ? "light"
        : "dark";


    setTheme(
      next
    );


    localStorage.setItem(
      "closingbell-theme",
      next
    );


    document.documentElement.classList.toggle(
      "dark",
      next ===
        "dark"
    );

  }


  return (
    <button
      type="button"
      onClick={
        toggle
      }
      title={
        theme === "dark"
          ? "Use light mode"
          : "Use dark mode"
      }
      aria-label={
        theme === "dark"
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-base shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
    >
      {theme === "dark"
        ? "☀"
        : "☾"}
    </button>
  );
}