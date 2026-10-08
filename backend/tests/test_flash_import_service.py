"""Flash import matches file names to invaders whatever their zero padding."""
from app.core.security import hash_password
from app.models.space_invader import Invader
from app.models.user import User
from app.models.user_progress import UserProgress
from app.services.flash_import_service import import_flashes


def test_matches_names_regardless_of_leading_zeros(db):
    user = User(username="u1", email="u1@test.com", hashed_password=hash_password("pw"))
    # The DB mixes both spellings: padded for some cities, bare for others.
    db.add_all([user] + [
        Invader(name=n, latitude=0, longitude=0, state="Good", points=10)
        for n in ("ORLN_01", "ORLN_10", "FTBL_4", "PA_100")
    ])
    db.flush()

    res = import_flashes(db, user.id, [
        "ORLN_01.jpg", "orln_10.png", "FTBL_04.jpg", "PA_1.jpg", "PA_100.jpg",
    ])

    assert res["imported"] == 4
    assert res["unknown"] == ["PA_1"]
    assert db.query(UserProgress).filter_by(user_id=user.id).count() == 4
