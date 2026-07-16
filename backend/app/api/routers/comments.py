"""
Invader comment wall.

- GET  /invaders/{id}/comments          public — guests read the wall too
- GET  /invaders/{id}/comments/summary  public — count + top comment (map popup)
- POST /invaders/{id}/comments          authenticated — auto-moderated at creation
- POST /comments/{id}/react             authenticated — like / dislike / clear
- POST /comments/{id}/report            authenticated — queue for admin review
- DELETE /comments/{id}                 owner or admin
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas.comment import CommentCreate, CommentOut, CommentSummaryOut, ReactionRequest
from app.dependencies import get_db, get_current_user, get_current_user_optional
from app.services import comment_service
from app.services.comment_service import InvaderMissing, CommentMissing, NotCommentOwner

router = APIRouter(tags=["Comments"])


def _to_out(comment, username: str, my_reaction: int = 0) -> CommentOut:
    return CommentOut.from_row(comment, username, my_reaction)


@router.get("/invaders/{invader_id}/comments", response_model=List[CommentOut])
def list_comments(
    invader_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    uid = current_user.id if current_user else None
    try:
        rows = comment_service.list_for_invader(db, invader_id, uid)
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    return [_to_out(comment, username, my) for comment, username, my in rows]


@router.get("/invaders/{invader_id}/comments/summary", response_model=CommentSummaryOut)
def comments_summary(
    invader_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    uid = current_user.id if current_user else None
    try:
        count, top = comment_service.get_summary(db, invader_id, uid)
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    return CommentSummaryOut.from_service(count, top)


@router.post("/invaders/{invader_id}/comments", response_model=CommentOut)
def create_comment(
    invader_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        comment = comment_service.create(db, current_user, invader_id, data.body.strip())
    except InvaderMissing:
        raise HTTPException(status_code=404, detail="Invader not found")
    return _to_out(comment, current_user.username)


@router.post("/comments/{comment_id}/react", response_model=CommentOut)
def react_comment(
    comment_id: int,
    data: ReactionRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        comment = comment_service.set_reaction(db, current_user, comment_id, data.value)
    except CommentMissing:
        raise HTTPException(status_code=404, detail="Comment not found")
    from app.models.user import User
    author = db.query(User).filter(User.id == comment.user_id).first()
    return _to_out(comment, author.username if author else "?", data.value)


@router.post("/comments/{comment_id}/report", response_model=CommentOut)
def report_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        comment = comment_service.report(db, comment_id)
    except CommentMissing:
        raise HTTPException(status_code=404, detail="Comment not found")
    # username of the author, not the reporter
    from app.models.user import User
    author = db.query(User).filter(User.id == comment.user_id).first()
    return _to_out(comment, author.username if author else "?")


@router.delete("/comments/{comment_id}")
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    try:
        comment_service.delete(db, comment_id, current_user)
    except CommentMissing:
        raise HTTPException(status_code=404, detail="Comment not found")
    except NotCommentOwner:
        raise HTTPException(status_code=403, detail="Not allowed")
    return {"message": "Comment deleted"}
