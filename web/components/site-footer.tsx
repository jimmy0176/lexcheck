import Link from "next/link";

/** 首页横幅图来自 Unsplash。 */
const unsplashReferral =
  "https://unsplash.com/?utm_source=hepartners&utm_medium=referral";

export function SiteFooter() {
  return (
    <footer id="contact" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="text-sm font-semibold tracking-[0.12em]">HE Partners</div>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              结构化问卷与律师工作台，帮助企业更高效地完成合规信息收集与后续跟进。
            </p>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              产品
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/q" className="text-foreground/90 hover:text-foreground">
                  企业法律体检
                </Link>
              </li>
              <li>
                <Link
                  href="/lawyer/checkups"
                  className="text-foreground/90 hover:text-foreground"
                >
                  律师工作台
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              账户
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/login/user" className="text-foreground/90 hover:text-foreground">
                  用户登录
                </Link>
              </li>
              <li>
                <Link href="/login/lawyer" className="text-foreground/90 hover:text-foreground">
                  律师登录
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t pt-8">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground/80">联系与主体信息</p>
            <p className="mt-1">
              运营主体全称、联系电话、邮箱及备案号请在上线前替换此处占位文案。
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HE Partners。保留所有权利。</p>
          <p className="max-w-xl sm:text-right">
            首页横幅图片来自{" "}
            <a
              href={unsplashReferral}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Unsplash
            </a>
            ，本站使用本地副本（/hero-bg.jpg）。
          </p>
        </div>
      </div>
    </footer>
  );
}
