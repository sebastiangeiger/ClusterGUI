#!/usr/bin/env ruby 
require 'optparse'
require 'fileutils'

class CommandlineArguments
  attr_reader :cuts_file, :output_folder, :images
  def initialize(argv)
    argv = argv.dup
    @cuts_file = argv.shift
    @output_folder = argv.pop
    if argv.size == 1
      pattern = argv.first
      @images = Dir.glob(pattern)
    else
      @images = argv.dup
    end
    @banner = "Usage: #{$0} cuts_file image_files output_folder"
    @errors = []
    check
  end

  def check
    error "Required: cuts_file" unless @cuts_file
    error "\"#{@cuts_file}\" does not exist or is not a file" unless File.file?(@cuts_file)
    error "Required: one or more image files" unless @images and @images.size > 0
    @images.each { |image| check_image(image) }
    error "Required: output folder" unless @output_folder 
    error "\"#{@output_folder}\" must either be an empty folder or not exist yet" unless not File.exists?(@output_folder) or folder_empty?(@output_folder)
  end

  def folder_empty?(folder)
    File.directory?(folder) and Dir.entries(folder).reject{|d| %w[. ..].include?(d)}.empty?
  end

  def check_image(image)
    error "\"#{image}\" does not exist or is not a file" unless File.file?(image)
  end

  def valid?
    @errors.empty? 
  end

  def print_error_message
    $stderr.puts @banner
    $stderr.puts @errors.join("\r\n")
  end

  private
  def error(string)
    @errors << string
  end
end

module Model
  class Events
    def self.load_from_file(file)
      content = IO.read(file)
      content = content.split(/\n|\r|\r\n/) if content.is_a? String #IO.read creates an array on MacOS, but not on Ubunutu
      events = content.collect do |line|
        Event.parse(line) unless line.strip.empty?
      end  
      events.sort{|a,b| a.frame_number <=> b.frame_number}
    end
  end

  class Event
    attr_reader :type, :frame_number
    module Type
      CUT = 0
      ATOM_TRANSITION = 1
      DISSOLVE = 2
      TITLE_SONG = 3
    end

    def self.parse(line)
      fragments = line.split(",").collect{|f| f.strip}.collect{|f| Integer(f)}
      raise "Not a valid line" unless fragments.size == 5 
      Event.new(:type => fragments.shift, :frame_number => fragments.pop, :time => fragments)
    end

    def initialize(options = {})
      @type = options[:type] || 0
      raise "type must be an integer (#{@type.inspect})" unless @type.is_a? Integer
      raise "frame_number must be specified" unless options[:frame_number]
      @frame_number = options[:frame_number] 
      raise "frame_number must be an integer (#{@frame_number.inspect})" unless @frame_number.is_a? Integer
    end

    def previous_frame
      frame_number - 1
    end
  end

  class Mapping
    def self.infer(events,images)
      # Well ideally this would be inferring, as of now the mapping is hardcoded
      Mapping.new(events,images)
    end

    def initialize(events,images)
      @events = events
      @images = images
    end

    def filename_for(frame_number)
      regex = Regexp.new("bbt_s(\\d{2})e(\\d{2})_0*#{frame_number}")
      seasons = @images.collect{|i| regex.match(i) ? regex.match(i)[1] : nil}.uniq.compact
      episodes = @images.collect{|i| regex.match(i) ? regex.match(i)[2] : nil}.uniq.compact
      raise "Could not find a match from frame number #{frame_number}. I am assuming the images are built up like this one for example: bbt_s01e01_000259.png" unless seasons.any? and episodes.any?
      raise "Please only supply images from one particular episode and season" unless seasons.size == 1 and episodes.size == 1
      @images.sort.select{|i| regex.match(i)}.first # Can get away with taking the first one on multiple matches because it will choose the "lowest" (Probably only important when matching frame number 0)
    end

    def frame_for(filename)
      match = Regexp.new("bbt_s(\\d{2})e(\\d{2})_(\\d+)\.").match(filename)
      raise "Could not find a match for \"#{filename}\". I am assuming the images are built up like this one for example: bbt_s01e01_000259.png" unless match
      frame_number = match[3].sub(/^0*/,"") # Removing leading 0s otherwise Integer might interpret them as octal numbers 
      Integer(frame_number)
    end
  end

  class Shot
    attr_reader :start_event, :end_event
    def initialize(start_event,end_event)
      # The beginning is a cut, the end is always a frame (since it's the frame before the next cut)
      @start_event = start_event
      @end_event = end_event
    end

    def start_frame
      @start_event.frame_number
    end

    def end_frame
      @end_event.previous_frame
    end
  end

  class Scenes
    def self.reconstruct(events, last_frame)
      # The first and the last frame are not in the cuts file
      # => Need to add the first event
      events.unshift(Event.new(:frame_number => 0)) 
      # => And the last one
      events << Model::Event.new(:frame_number => last_frame)
      # Now we have a comprehensive events list
      scenes = Model::Scenes.from_events(events)
    end

    def self.from_events(events)
      scenes = [Scene.new] # Starting with an inital scene
      events = events.sort{|a,b| a.frame_number <=> b.frame_number}
      (0..events.size-2).each do |i|
        current_event = events[i]
        following_event = events[i+1]
        # All event types except CUT are pairwise, so the first event of that pair delimits a scene, while the second starts a Shot
        if current_event.type != Event::Type::CUT and following_event.type != Event::Type::CUT
          scenes << Scene.new
        else
          scenes.last.add_shot(Shot.new(current_event, following_event))
        end
      end
      return scenes
    end
  end

  class Scene
    attr_reader :shots
    def initialize(first_shot = nil)
      @shots = []
      @shots << first_shot if first_shot
    end
    def add_shot(shot)
      @shots << shot
    end
  end
end

class Output
  def self.write_images(output_folder,scenes,mapping, options = {})
    make_folder(output_folder,options[:verbose])
    scenes.each_with_index do |scene, number|
      current_scene_folder = File.join(output_folder, "scene_#{number+1}")
      make_folder(current_scene_folder,options[:verbose])
      scene.shots.each do |shot|
        start_file = mapping.filename_for(shot.start_frame)
        end_file = mapping.filename_for(shot.end_frame)
        copy_and_resize(start_file,current_scene_folder,options[:verbose])
        copy_and_resize(end_file,current_scene_folder,options[:verbose])
      end
    end
  end

  def self.make_folder(folder, verbose)
    puts "Created #{folder}" if verbose
    Dir.mkdir(folder) unless File.directory?(folder)
  end

  def self.copy_and_resize(file, target_folder, verbose)
    target = File.join(target_folder, File.basename(file))
    if mogrify_is_installed? 
      width = 400
      puts "   Copying #{file} to #{target} while resizing it to a width of #{width}" if verbose
      system "mogrify -resize #{width} -path #{target_folder} #{file}"
    else
      puts "   Copying #{file} to #{target} without resizing it" if verbose
      FileUtils.cp(file, target)
    end
  end

  def self.mogrify_is_installed?
    system "hash mogrify 2>/dev/null"
    $? == 0
  end
end

if $0 == __FILE__
  args = CommandlineArguments.new(ARGV)
  if args.valid?
    events = Model::Events.load_from_file(args.cuts_file)
    mapping = Model::Mapping.infer(events,args.images)
    last_frame = mapping.frame_for(args.images.last)
    scenes = Model::Scenes.reconstruct(events, last_frame)
    Output::write_images(args.output_folder,scenes, mapping, :verbose => true)
  else
    args.print_error_message 
  end
end
