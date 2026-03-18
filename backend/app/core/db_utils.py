
def safe_commit(db):
    try:
        db.commit()
    except:
        db.rollback()
        raise