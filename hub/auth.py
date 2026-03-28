"""GitHub org membership auth."""
import httpx
from fastapi import HTTPException, Header

ORG = "na-linii"


async def verify_github_token(authorization: str = Header(default="")):
    """Verify GitHub PAT and org membership. Returns user info."""
    token = authorization.replace("Bearer ", "").strip()
    if not token:
        raise HTTPException(401, "Authorization header required (Bearer <github-pat>)")

    async with httpx.AsyncClient(timeout=10) as client:
        # Check token
        r = await client.get("https://api.github.com/user", headers={"Authorization": f"Bearer {token}"})
        if r.status_code != 200:
            raise HTTPException(401, "Invalid GitHub token")
        user = r.json()

        # Check org membership
        r2 = await client.get(
            f"https://api.github.com/orgs/{ORG}/members/{user['login']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        if r2.status_code != 204:
            raise HTTPException(403, f"Not a member of {ORG}")

    return {"login": user["login"], "avatar": user.get("avatar_url", ""), "name": user.get("name", "")}
