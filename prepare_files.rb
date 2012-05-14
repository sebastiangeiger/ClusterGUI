#!/usr/bin/env ruby -w
require 'optparse'

class CommandlineArguments

  def initialize(argv)
    argv = argv.dup
    @cuts_file = argv.shift
    @output_folder = argv.pop
    @images = argv.dup
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

  args = CommandlineArguments.new(ARGV)
  if args.valid?
  else
    args.print_error_message 
  end
