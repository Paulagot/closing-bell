"use client";

import {
  useEffect,
} from "react";

import {
  WRAPPER_INFO,
} from "@/lib/wrapperInfo";

interface Props {
  open: boolean;
  onClose: () => void;

  issuer: string;
  symbol: string;

  underlyingName: string;
  ticker: string;
}

export default function WrapperInfoDrawer({
  open,
  onClose,
  issuer,
  symbol,
  underlyingName,
  ticker,
}: Props) {

  const info =
    WRAPPER_INFO[
      issuer
    ];


  useEffect(
    () => {

      if (!open) {
        return;
      }


      function onKeyDown(
        event: KeyboardEvent
      ) {

        if (
          event.key ===
          "Escape"
        ) {
          onClose();
        }

      }


      document.addEventListener(
        "keydown",
        onKeyDown
      );


      const previousOverflow =
        document.body.style
          .overflow;


      document.body.style.overflow =
        "hidden";


      return () => {

        document.removeEventListener(
          "keydown",
          onKeyDown
        );

        document.body.style.overflow =
          previousOverflow;

      };

    },
    [
      open,
      onClose,
    ]
  );


  if (
    !open ||
    !info
  ) {
    return null;
  }


  return (
    <div className="fixed inset-0 z-[100]">

      <button
        type="button"
        aria-label="Close wrapper information"
        onClick={
          onClose
        }
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
      />


      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">

        <div className="p-5 md:p-7">

          <div className="flex items-start justify-between gap-4">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                Understand what you're buying
              </div>


              <h2 className="mt-2 text-2xl font-black text-gray-950 dark:text-white">

                {symbol}

              </h2>


              <div className="mt-1 text-sm text-gray-500 dark:text-slate-400">

                {issuer} wrapper of{" "}
                {underlyingName} ({ticker})

              </div>

            </div>


            <button
              type="button"
              onClick={
                onClose
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-xl text-gray-500 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              ×
            </button>

          </div>


          <div className="mt-7 space-y-5">

            <InfoBlock
              label="What is it?"
              value={
                info.shortDescription
              }
            />


            <InfoBlock
              label="Issuer / structure"
              value={
                info.issuer
              }
            />


            <InfoBlock
              label="Backing"
              value={
                info.backing
              }
            />


            <InfoBlock
              label="Redemption / conversion"
              value={
                info.redemption
              }
            />


            <InfoBlock
              label="Trading availability"
              value={
                info.availability
              }
            />


            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">

              <div className="text-sm font-bold text-amber-950 dark:text-amber-200">
                What is different from owning the stock?
              </div>


              <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900 dark:text-amber-100/80">

                {info.important.map(
                  (
                    item
                  ) => (
                    <li
                      key={
                        item
                      }
                      className="flex gap-2"
                    >
                      <span>
                        •
                      </span>

                      <span>
                        {item}
                      </span>
                    </li>
                  )
                )}

              </ul>

            </div>

          </div>


          <div className="mt-7 border-t border-gray-100 pt-5 text-xs leading-5 text-gray-400 dark:border-slate-800 dark:text-slate-500">
            Closing Bell provides product information for comparison purposes. Eligibility, redemption rights and legal terms depend on the issuer's current documentation and your jurisdiction.
          </div>

        </div>

      </aside>

    </div>
  );
}


function InfoBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (
    <div>

      <div className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        {label}
      </div>


      <div className="mt-1 text-sm leading-6 text-gray-700 dark:text-slate-200">
        {value}
      </div>

    </div>
  );
}