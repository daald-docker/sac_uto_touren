system("wget -qO- https://astral.sh/uv/install.sh | sh") || abort("ERROR while installing uv")
ENV['PATH'] = "#{File.expand_path('~/.local/bin')}:#{ENV['PATH']}"

#system("git remote set-branches --add origin main-python-2026")  # repo was fetched using --single-branch
#system("git fetch")
#system("git checkout main-python-2026") || abort("ERROR while checking out branch")
system("git clone https://github.com/daald-docker/sac_uto_touren.git --single-branch --branch main-python-2026 scraper-py") || abort("ERROR while cloning repo")
system("cp data.sqlite scraper-py/")
puts ""

Dir.chdir("scraper-py") do
  print "Revision: "
  system("git rev-parse HEAD")
  puts ""
  system("uv run scraper.py") || abort("ERROR while running script")
end
system("mv scraper-py/data.sqlite .")
