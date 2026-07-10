require 'xcodeproj'

project = Xcodeproj::Project.open('MP3Player.xcodeproj')
target = project.targets.find { |t| t.name == 'MP3Player' }
group = project.main_group.children.find { |g| g.display_name == 'MP3Player' }

['TTSWriter.h', 'TTSWriter.mm'].each do |filename|
  next if group.files.any? { |f| f.display_name == filename }
  file_ref = group.new_file("MP3Player/#{filename}")
  target.source_build_phase.add_file_reference(file_ref) if filename.end_with?('.mm')
end

project.save
puts 'Added TTSWriter.h and TTSWriter.mm to MP3Player target'
