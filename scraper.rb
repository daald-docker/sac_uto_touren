system("wget -qO- https://astral.sh/uv/install.sh | sh") || abort("ERROR while installing uv")
ENV['PATH'] = "#{File.expand_path('~/.local/bin')}:#{ENV['PATH']}"

system("git remote set-branches --add origin main-python-2026")  # repo was fetched using --single-branch
system("git fetch")
system("git checkout main-python-2026") || abort("ERROR while checking out branch")

puts ""

print "Revision: "
system("git rev-parse HEAD")

puts ""
success = system("uv run scraper.py") || abort("ERROR while running script")
