"""The presentation site is reachable at /site."""


def test_site_redirects_to_static_page(client):
    res = client.get("/site", follow_redirects=False)
    assert res.status_code == 307
    assert res.headers["location"] == "/static/site/index.html"

    page = client.get("/static/site/index.html")
    assert page.status_code == 200
    assert "InvadersHunter" in page.text
