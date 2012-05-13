if (window.File && window.FileReader && window.FileList && window.Blob) {
  //Great success! All the File APIs are supported.
} else {
  alert('The File APIs are not fully supported in this browser.');
}

$(function(){
  var Image = Backbone.Model.extend({
    initialize: function(file){
      this.set({file:file});
    },
    setUrl: function(url){
      this.set({url:url});
    }
  });

  var Scene = Backbone.Model.extend({
    initialize: function(startImage,endImage){
      this.set({startImage:startImage, endImage:endImage});
    } 
  });

  var Cluster = Backbone.Model.extend({
    initialize: function(scene){
      this.set({scenes: [scene]});
    },
    select: function() {
      this.set({selected:true});
    },
    unselect: function() {
      this.set({selected:false});
    },
    scenes: function(){
      return this.get('scenes');
    },
    addScenes: function(scenes){
      var that = this;
      _.each(scenes, function(scene){ that.addScene(scene) });
    },
    addScene: function(scene){
      this.get('scenes').push(scene);
      this.trigger('add',scene);
    },
    merge: function(anotherCluster){
      console.log("meeeergee");
      this.addScenes(anotherCluster.scenes());
      anotherCluster.destroy();
    }
  });

  var ClusterList = Backbone.Collection.extend({
    model: Cluster,
    setSelected: function(cluster){
      if(!this.selectedCluster()){
        cluster.select();
      } else if (this.selectedCluster() === cluster) {
        cluster.unselect();
      } else {
        var clusterToMerge = this.selectedCluster(); 
        clusterToMerge.unselect();
        cluster.merge(clusterToMerge);
      }
    },
    selectedCluster: function(){
      return this.where({selected:true})[0];
    }
  });

  var ImageList = Backbone.Collection.extend({
    model: Image
  });

  var Images = new ImageList();
  var Clusters = new ClusterList();

  var ClusterView = Backbone.View.extend({
    //Ideally Cluster would have been a collection, but since ClusterList already is one it doesn't work!
    tagName: "div",
    className: "cluster",
    events: {
      "click": "select"
    },
    initialize: function(){
      this.model.bind('change', this.render, this);
      this.model.bind('destroy', this.remove, this);
      this.model.bind('add', this.addOne, this);
      this.firstTime = true; //Working around the fact that Cluster isn't a Collection
    },
    render: function() {
      if(this.firstTime){
        var sceneView = new SceneView({model: this.model.get('scenes')[0]});
        this.$el.append(sceneView.render().$el);
        this.firstTime = false;
      }
      if(this.model.get('selected') && !this.$el.hasClass('selected')){
        this.$el.addClass('selected');
      } else if (!this.model.get('selected') && this.$el.hasClass('selected')) {
        this.$el.removeClass('selected');
      }
      return this;
    },
    select: function(){
      Clusters.setSelected(this.model);
    },
    addOne: function(scene){
      var newSceneView = new SceneView({model: scene}); //Ideally I would just transfer the old view
      this.$el.append(newSceneView.render().$el);
    }
  });

  var SceneView = Backbone.View.extend({
    tagName: "div",
    className: "scene",
    render: function() {
      var startImageView = new ImageView({model: this.model.get('startImage')});
      var endImageView = new ImageView({model: this.model.get('endImage')});
      this.$el.append(startImageView.render().$el);
      this.$el.append("...");
      this.$el.append(endImageView.render().$el);
      return this;
    },
  });

  var ImageView = Backbone.View.extend({
    tagName: "span",
    className: "image",
    initialize: function(){
      this.model.bind('change', this.render, this); 
    },
    template: _.template('<img src="<%= imageSrc %>"/>'),
    render: function() {
      if(this.model.get('url')){
        this.$el.html(this.template({name: this.model.get('name'), imageSrc:this.model.get('url')}));
      } else {
        this.$el.text("Loading...");
      }
      return this;
    }
  });

  var DropZoneView = Backbone.View.extend({
    el: $('#drop_zone'),
    events: {
      "drop": "uploadFile",
      "dragover": "handleDragOver",
      "dragleave": "handleDragLeave"
    },
    uploadFile: function(evt){
      evt.stopPropagation();
      evt.preventDefault();
      $(this.el).removeClass('files_hovering_over');
      $(this.el).slideUp();
      var files = evt.originalEvent.dataTransfer.files;
      _.map(files, function(file){
        var reader = new FileReader();
        var image = new Image(file);
        Images.add(image)
        reader.onload = (function(theImage){
          return function(event){
            theImage.setUrl(event.target.result)
          }
        })(image);
        reader.readAsDataURL(file);
      }); 
      for(var i=0; i<Images.length; i+=2){
        var scene = new Scene(Images.at(i),Images.at(i+1));
        Clusters.add(new Cluster(scene));
      }

    },

    handleDragOver: function(evt) {
      var event = evt.originalEvent; 
      event.stopPropagation();
      event.preventDefault();
      event.dataTransfer.dropEffect = 'link'; // Explicitly show this is a link.
      $(this.el).addClass('files_hovering_over');
    },

    handleDragLeave: function(evt) {
      var event = evt.originalEvent; 
      event.stopPropagation();
      event.preventDefault();
      $(this.el).removeClass('files_hovering_over');
    }
  });

  var AppView = Backbone.View.extend({
    el: $('body'),
    initialize: function(){
      this.dropZone = new DropZoneView;
      this.clusterList = this.$("#list");
      this.footer = this.$("#footer");
      Clusters.bind('add', this.addOne, this);
      // Clusters.bind('remove', this.remove, this);
      this.render();
    },
    render: function(){
      this.footer.text(Clusters.length + " clusters");
    },
    addOne: function(cluster){
      var view = new ClusterView({model:cluster});
      $(this.clusterList).append(view.render().$el);
      this.render();
    }

  });

  var App = new AppView;

});

// class Scene
//   attr_reader :start_image_path, :end_image_path
//   def initialize(start_image,end_image)
//     @start_image_path = start_image
//     @end_image_path = end_image
//   end
// end
// 
var Scene = Backbone.Model.extend({
  initialize: function(start_image_path) {
    this.set({start_image_path: start_image_path});
  }
});
// class Cluster
//   attr_reader :scenes
//   def initialize(scene)
//     @scenes = [scene]
//   end
// 
//   def merge(another_cluster)
//     @scenes += another_cluster.scenes
//     another_cluster.empty_out!
//   end
// 
//   def empty_out!
//     @scenes = []
//   end
// end
//

  
