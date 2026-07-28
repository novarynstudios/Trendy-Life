import Link from "next/link"
import { notFound } from "next/navigation"
import { Star } from "lucide-react"
import { moderateReviewAction } from "../../actions"
import { getCsrfToken, requireStaff } from "@/src/server/auth/staff"
import { prisma } from "@/src/server/db/prisma"

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("marketing.view")
  const [{ id }, csrfToken] = await Promise.all([params, getCsrfToken()])
  const review = await prisma.review.findUnique({ where: { id }, include: { product: true, user: { include: { profile: true } } } })
  if (!review) notFound()
  return <><header className="tl-page-header"><div><nav className="tl-breadcrumbs"><Link href="/admin">Administration</Link><span>/</span><Link href="/admin/reviews">Reviews</Link><span>/</span><span>{review.id.slice(-8)}</span></nav><h1>{review.title ?? "Product review"}</h1><p>{review.product.name} · {review.user?.profile ? `${review.user.profile.firstName} ${review.user.profile.lastName}` : "Guest"}</p></div><span className={`tl-status ${review.status.toLocaleLowerCase()}`}>{review.status.toLocaleLowerCase()}</span></header><section className="tl-card tl-narrow-form"><div className="tl-card-header"><span className="tl-stars">{Array.from({ length: review.rating }, (_, index) => <Star key={index} size={14} fill="currentColor" />)}</span><span>{review.verified ? "Verified purchase" : "Unverified"}</span></div><div className="tl-card-body"><p>{review.body}</p></div><form className="tl-review-actions" action={moderateReviewAction}><input type="hidden" name="_csrf" value={csrfToken} /><input type="hidden" name="reviewId" value={review.id} /><label>Staff response<textarea name="staffResponse" rows={5} defaultValue={review.staffResponse ?? ""} /></label><label className="tl-checkbox"><input name="featured" type="checkbox" defaultChecked={review.featured} /><span>Feature review</span></label><button className="tl-button tl-button-success" name="status" value="APPROVED">Approve</button><button className="tl-button" name="status" value="REJECTED">Reject</button><button className="tl-button tl-button-danger" name="status" value="SPAM">Mark spam</button></form></section></>
}
