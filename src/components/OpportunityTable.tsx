import Link from "next/link";

import {
  fmtPct,
  fmtUsd,
} from "@/lib/market";

import IssuerBadge from "@/components/IssuerBadge";

import type {
  ExecutionOpportunity,
} from "@/types";


interface Props {
  opportunities:
    ExecutionOpportunity[];

  loading?: boolean;
}


export default function OpportunityTable({
  opportunities,
  loading = false,
}: Props) {

  if (
    loading
  ) {

    return (
      <section className="mb-5 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">

        <div className="border-b border-gray-100 px-5 py-4 dark:border-slate-800">

          <div className="text-sm font-black text-gray-900 dark:text-white">
            Cross-issuer opportunities
          </div>


          <div className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
            Comparing latest stored $1,000 executable BUY prices across issuers
          </div>

        </div>


        <div className="flex min-h-28 items-center justify-center">

          <div className="text-center">

            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-violet-500 dark:border-slate-700 dark:border-t-violet-400" />


            <div className="mt-2 text-xs text-gray-400 dark:text-slate-500">
              Reading stored execution snapshots…
            </div>

          </div>

        </div>

      </section>
    );

  }


  if (
    opportunities.length ===
    0
  ) {

    return (
      <section className="mb-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">

        <div className="text-sm font-black text-gray-900 dark:text-white">
          Cross-issuer opportunities
        </div>


        <div className="mt-1 text-xs leading-5 text-gray-400 dark:text-slate-500">
          No stored stock snapshot currently has two successful $1,000 executable BUY routes to compare. Open stock pages or run the history collector to build coverage.
        </div>

      </section>
    );

  }


  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">

      <div className="border-b border-gray-100 px-4 py-4 dark:border-slate-800 md:px-5">

        <div className="flex flex-wrap items-end justify-between gap-3">

          <div>

            <div className="text-sm font-black text-gray-900 dark:text-white">
              Cross-issuer opportunities
            </div>


            <div className="mt-0.5 text-[11px] text-gray-400 dark:text-slate-500">
              Where issuer choice made the biggest difference in the latest stored $1,000 BUY snapshots
            </div>

          </div>


          <div className="text-[10px] text-gray-400 dark:text-slate-600">
            Lower stored executable BUY price wins
          </div>

        </div>

      </div>


      {/* Desktop */}

      <div className="hidden overflow-x-auto md:block">

        <table className="w-full text-xs">

          <thead>

            <tr className="border-b border-gray-100 bg-gray-50/70 dark:border-slate-800 dark:bg-slate-900/50">

              <th className="px-5 py-2.5 text-left font-medium text-gray-400 dark:text-slate-500">
                #
              </th>


              <th className="px-3 py-2.5 text-left font-medium text-gray-400 dark:text-slate-500">
                Stock
              </th>


              <th className="px-3 py-2.5 text-left font-medium text-gray-400 dark:text-slate-500">
                Best issuer
              </th>


              <th className="px-3 py-2.5 text-right font-medium text-gray-400 dark:text-slate-500">
                $1K BUY
              </th>


              <th className="px-3 py-2.5 text-right font-medium text-gray-400 dark:text-slate-500">
                Next best
              </th>


              <th className="px-3 py-2.5 text-right font-medium text-gray-400 dark:text-slate-500">
                Saving
              </th>


              <th className="px-3 py-2.5 text-right font-medium text-gray-400 dark:text-slate-500">
                Advantage
              </th>


              <th className="px-5 py-2.5" />

            </tr>

          </thead>


          <tbody>

            {opportunities.map(
              (
                opportunity,
                index
              ) => (

                <tr
                  key={
                    opportunity.ticker
                  }
                  className="border-b border-gray-100 transition last:border-0 hover:bg-gray-50/60 dark:border-slate-800 dark:hover:bg-slate-900/50"
                >

                  <td className="px-5 py-3 font-black text-gray-300 dark:text-slate-700">
                    {index + 1}
                  </td>


                  <td className="px-3 py-3">

                    <div className="font-black text-gray-900 dark:text-white">
                      {
                        opportunity.ticker
                      }
                    </div>


                    <div className="text-[10px] text-gray-400 dark:text-slate-500">
                      {
                        opportunity.stockName
                      }
                    </div>

                  </td>


                  <td className="px-3 py-3">

                    <IssuerBadge
                      issuer={
                        opportunity.bestIssuer
                      }
                    />

                  </td>


                  <td className="px-3 py-3 text-right font-black tabular-nums text-gray-950 dark:text-white">
                    {fmtUsd(
                      opportunity.bestEffectivePrice
                    )}
                  </td>


                  <td className="px-3 py-3 text-right">

                    <div className="flex justify-end">
                      <IssuerBadge
                        issuer={
                          opportunity.otherIssuer
                        }
                      />
                    </div>


                    <div className="mt-1 text-[9px] text-gray-400 dark:text-slate-500">
                      {fmtUsd(
                        opportunity.otherEffectivePrice
                      )}
                    </div>

                  </td>


                  <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {fmtUsd(
                      opportunity.estimatedSavingUsd
                    )}
                  </td>


                  <td className="px-3 py-3 text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {fmtPct(
                      opportunity.savingPct
                    )}
                  </td>


                  <td className="px-5 py-3 text-right">

                    <Link
                      href={`/stock/${opportunity.ticker}`}
                      className="font-bold text-violet-600 transition hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      Analyse →
                    </Link>

                  </td>

                </tr>

              )
            )}

          </tbody>

        </table>

      </div>


      {/* Mobile */}

      <div className="divide-y divide-gray-100 dark:divide-slate-800 md:hidden">

        {opportunities.map(
          (
            opportunity,
            index
          ) => (

            <Link
              key={
                opportunity.ticker
              }
              href={`/stock/${opportunity.ticker}`}
              className="block p-4 transition hover:bg-gray-50 dark:hover:bg-slate-900/60"
            >

              <div className="flex items-start justify-between gap-3">

                <div className="flex gap-3">

                  <div className="text-sm font-black text-gray-300 dark:text-slate-700">
                    {index + 1}
                  </div>


                  <div>

                    <div className="font-black text-gray-900 dark:text-white">
                      {
                        opportunity.ticker
                      }
                    </div>


                    <div className="text-[10px] text-gray-400 dark:text-slate-500">
                      {
                        opportunity.stockName
                      }
                    </div>

                  </div>

                </div>


                <div className="text-right">

                  <div className="text-[9px] text-gray-400 dark:text-slate-500">
                    $1K stored issuer advantage
                  </div>


                  <div className="font-black text-emerald-600 dark:text-emerald-400">
                    {fmtUsd(
                      opportunity.estimatedSavingUsd
                    )}
                  </div>


                  <div className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmtPct(
                      opportunity.savingPct
                    )}
                  </div>

                </div>

              </div>


              <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">

                <div className="flex items-center gap-2">

                  <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                    Best
                  </span>


                  <IssuerBadge
                    issuer={
                      opportunity.bestIssuer
                    }
                  />

                </div>


                <div className="text-xs font-black text-gray-950 dark:text-white">
                  {fmtUsd(
                    opportunity.bestEffectivePrice
                  )}
                </div>

              </div>


              <div className="mt-2 text-right text-[10px] font-bold text-violet-600 dark:text-violet-400">
                Analyse execution →
              </div>

            </Link>

          )
        )}

      </div>

    </section>
  );
}