from sync_prompts import parse_prompt_file, PROMPTS_DIR


def test_module_files_discovered_and_parsed():
    mod_dir = PROMPTS_DIR / "text" / "modules"
    files = sorted(mod_dir.glob("*.md"))
    assert files, "expected at least one text module file"
    names = {parse_prompt_file(p)["name"] for p in files}
    assert "faq-no-data" in names
    assert "booking-ortho-routing" in names
