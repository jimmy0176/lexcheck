import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { HomeLoginPanel } from "./HomeLoginPanel";

/**
 * 三张装饰线条图直接钉在面板三个角上（右上角留给"联系我们"按钮，不放装饰）：
 * 用 left/top 或 right/bottom 各取 0，让图片自身对应的那个角精确贴合面板对应角，
 * 不再按视口 vw/vh 换算坐标——原坐标是照着另一套画布尺寸给的，换到我们这个面板上对不上。
 */
function BrandDecoWaves() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-waves/top-left.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute left-0 top-0"
        style={{ width: 636, height: 515 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-waves/bottom-left.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0"
        style={{ width: 630, height: 176 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-waves/bottom-right.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0"
        style={{ width: 518, height: 508 }}
      />
    </>
  );
}

export default async function Home() {
  const user = await getSessionUser();
  if (user) {
    redirect(user.role === "lawyer" ? "/lawyer/checkups/lexcheck" : "/q");
  }

  return (
    <main className="flex min-h-dvh">
      <div className="flex w-full flex-col items-center justify-center bg-muted/12 px-8 py-16 sm:w-1/2 sm:px-16 lg:px-24">
        <div className="w-full max-w-[35rem] rounded-2xl bg-white p-12 shadow-xl sm:p-14 lg:p-16">
          <h1 className="text-6xl font-normal tracking-tight text-[#007BFC]">欢迎回来</h1>
          <div className="mt-12">
            <HomeLoginPanel />
          </div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-[#030F59] sm:flex sm:w-1/2 sm:flex-col sm:justify-between">
        <BrandDecoWaves />

        <div className="relative z-10 flex justify-end px-8 pt-8">
          <button
            type="button"
            className="flex h-[66px] items-center justify-center rounded-md border border-white px-8 text-xl text-white transition-colors hover:bg-white/10"
          >
            联系我们
          </button>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-8">
          <span className="-translate-y-16 font-heading text-7xl font-semibold leading-none tracking-[0.06em] text-white lg:text-8xl">
            HE Partners
          </span>
        </div>
      </div>
    </main>
  );
}
